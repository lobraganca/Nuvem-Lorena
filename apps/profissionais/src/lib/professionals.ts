import { supabase } from "./supabase";
import type {
  CategorySponsorship,
  ContactRequest,
  ContactRequestStatus,
  LeadCredits,
  Professional,
  Review,
} from "../types/domain";

export type SortOption = "relevance" | "rating" | "reviews";

export const DEFAULT_PAGE_SIZE = 20;

export interface SearchFilters {
  city?: string;
  category?: string;
  text?: string;
  minRating?: number;
  sort?: SortOption;
  /** Para paginação incremental: página 0-based. Padrão 20 por página. */
  page?: number;
  pageSize?: number;
  /** Admin: incluir/filtrar por suspensos. Sem efeito na busca pública (que já filtra via RLS). */
  onlySuspended?: boolean;
}

export interface ProfessionalWithRating extends Professional {
  average_rating: number | null;
  review_count: number;
}

/** Selo de verificação só conta se `verified` estiver true E não tiver expirado. */
export function isCurrentlyVerified(p: Pick<Professional, "verified" | "verified_until">): boolean {
  return !!p.verified && (!p.verified_until || new Date(p.verified_until) > new Date());
}

/** Anúncio turbinado só conta se `boosted` estiver true E não tiver expirado. */
export function isCurrentlyBoosted(p: Pick<Professional, "boosted" | "boosted_until">): boolean {
  return !!p.boosted && (!p.boosted_until || new Date(p.boosted_until) > new Date());
}

/** Empresa Plus só conta se `plus_active` estiver true E não tiver expirado. */
export function isCurrentlyPlusActive(p: Pick<Professional, "plus_active" | "plus_until">): boolean {
  return !!p.plus_active && (!p.plus_until || new Date(p.plus_until) > new Date());
}

/**
 * Busca profissionais com filtros de cidade/categoria/texto, ordenando
 * anúncios turbinados primeiro (e, dentro de cada grupo, os mais novos).
 * Sem banco configurado, devolve uma lista vazia — as telas tratam isso como
 * "nenhum resultado" em vez de quebrar.
 *
 * Leitura pública usa a view `professionals_public` (sem a coluna
 * `document`, que é CPF/CNPJ do anunciante — não deve vazar em leitura
 * pública, ver migration 0012).
 */
export async function searchProfessionals(filters: SearchFilters): Promise<ProfessionalWithRating[]> {
  const client = supabase();
  if (!client) return [];

  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let query = client
    .from("professionals_public")
    .select("*")
    .order("boosted", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.city) query = query.eq("city", filters.city);
  // Casa com qualquer um dos serviços do anúncio, não só o principal.
  if (filters.category) query = query.contains("categories", [filters.category]);
  if (filters.text) {
    query = query.or(`name.ilike.%${filters.text}%,bio.ilike.%${filters.text}%`);
  }
  if (filters.onlySuspended) query = query.eq("suspended", true);

  const { data, error } = await query;
  if (error || !data) return [];

  const ratings = await fetchRatingsMap(client, data.map((p) => p.id));
  let results = data.map((p) => ({
    ...p,
    average_rating: ratings[p.id]?.average_rating ?? null,
    review_count: ratings[p.id]?.review_count ?? 0,
  }));

  if (filters.minRating) {
    const min = filters.minRating;
    results = results.filter((p) => (p.average_rating ?? 0) >= min);
  }

  if (filters.sort === "rating") {
    results = [...results].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
  } else if (filters.sort === "reviews") {
    results = [...results].sort((a, b) => b.review_count - a.review_count);
  }
  // "relevance" (padrão) mantém a ordenação já vinda do banco: turbinados
  // primeiro, depois mais recentes.

  return results;
}

async function fetchRatingsMap(client: NonNullable<ReturnType<typeof supabase>>, ids: string[]) {
  if (ids.length === 0) return {} as Record<string, { average_rating: number; review_count: number }>;
  const { data } = await client.from("professional_ratings").select("*").in("professional_id", ids);
  const map: Record<string, { average_rating: number; review_count: number }> = {};
  for (const row of data ?? []) {
    map[row.professional_id] = { average_rating: row.average_rating, review_count: row.review_count };
  }
  return map;
}

export async function getProfessional(id: string): Promise<ProfessionalWithRating | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.from("professionals_public").select("*").eq("id", id).single();
  if (error || !data) return null;
  const ratings = await fetchRatingsMap(client, [id]);
  // Registra a visualização de perfil (alimenta o analytics do Empresa
  // Plus) de forma best-effort: nunca deve derrubar a página se falhar.
  try {
    await client.from("profile_views").insert({ professional_id: id });
  } catch {
    // silenciosamente ignorado — a página já carregou normalmente.
  }
  return { ...data, average_rating: ratings[id]?.average_rating ?? null, review_count: ratings[id]?.review_count ?? 0 };
}

export async function getReviews(professionalId: string): Promise<Review[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("reviews")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Conta quantas vezes cada etiqueta foi dada ao profissional, para o resumo
 * de reputação no topo das avaliações (`Pontual (12)` `Preço justo (8)`).
 * É calculado no client a partir das reviews já carregadas — não vale a pena
 * uma view SQL só para isso, já que a página sempre baixa a lista inteira.
 */
export function aggregateReviewTags(reviews: Review[], limit = 5): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const tag of review.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"))
    .slice(0, limit);
}

/**
 * Cria (ou substitui, via unique `professional_id,user_id`) a avaliação do
 * usuário. `comment` e `tags` podem vir vazios — só a nota é obrigatória,
 * que é o ponto do formulário de etiquetas rápidas.
 */
export async function addReview(input: {
  professional_id: string;
  user_id: string;
  rating: number;
  tags: string[];
  comment: string;
}) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reviews").upsert(input, { onConflict: "professional_id,user_id" });
  if (error) throw error;
  // Aviso ao dono do anúncio é best-effort: nunca deve derrubar o fluxo de
  // avaliação se a Edge Function falhar ou não estiver configurada.
  try {
    await client.functions.invoke("notify-new-review", {
      body: { professionalId: input.professional_id, rating: input.rating },
    });
  } catch {
    // silenciosamente ignorado — avaliação já foi salva.
  }
}

/**
 * Autor edita a própria avaliação (rating/tags/comment). RLS garante que só
 * o autor pode dar update, e o trigger `reviews_valida_campos_update`
 * (migrations 0011/0020) garante que ele só mexe nesses três campos.
 */
export async function updateReview(reviewId: string, input: { rating: number; tags: string[]; comment: string }) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reviews").update(input).eq("id", reviewId);
  if (error) throw error;
}

/** Autor apaga a própria avaliação. RLS garante que só o autor pode. */
export async function deleteReview(reviewId: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

/** Dono do anúncio responde a uma avaliação recebida. RLS garante que só o dono pode. */
export async function replyToReview(reviewId: string, reply: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client
    .from("reviews")
    .update({ reply, replied_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) throw error;
}

export async function getMyProfessionals(ownerId: string): Promise<Professional[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("professionals").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Checa (via RPC `check_document_banned`, função security definer — não há
 * select público em `document_bans`) se o CPF/CNPJ informado está bloqueado
 * por causa de um cadastro removido anteriormente pelo admin.
 */
export async function isDocumentBanned(document: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data, error } = await client.rpc("check_document_banned", { doc: document });
  if (error) return false;
  return !!data;
}

/**
 * Cria ou atualiza um anúncio. Em update (input.id presente), remove
 * `photo_url` do payload quando ele não foi explicitamente informado (ex:
 * `undefined`), para não sobrescrever a foto já salva com `null` só porque o
 * usuário editou outros campos sem trocar a foto — quem chama deve passar
 * `photo_url: null` explicitamente só se realmente quiser apagar a foto.
 */
export async function upsertProfessional(input: Partial<Professional> & { owner_id: string }): Promise<Professional> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (input.document && (await isDocumentBanned(input.document))) {
    throw new Error("Este CPF/CNPJ está impedido de se cadastrar na plataforma.");
  }
  const payload = { ...input };
  if (payload.id && payload.photo_url === undefined) {
    delete payload.photo_url;
  }
  const { data, error } = await client.from("professionals").upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function reportProfessional(input: {
  professional_id: string;
  reporter_id: string | null;
  reason: string;
  details: string;
  fingerprint?: string | null;
}) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reports").insert({
    professional_id: input.professional_id,
    reporter_id: input.reporter_id,
    reason: input.reason,
    details: input.details || null,
    reporter_fingerprint: input.fingerprint || null,
  });
  if (error) throw error;
}

/** Lista os ids dos profissionais favoritados pelo usuário logado. */
export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const client = supabase();
  if (!client) return new Set();
  const { data } = await client.from("favorites").select("professional_id").eq("user_id", userId);
  return new Set((data ?? []).map((f: { professional_id: string }) => f.professional_id));
}

/** Lista os profissionais favoritados pelo usuário logado, com rating. */
export async function getFavoriteProfessionals(userId: string): Promise<ProfessionalWithRating[]> {
  const client = supabase();
  if (!client) return [];
  const { data: favs } = await client.from("favorites").select("professional_id").eq("user_id", userId);
  const ids = (favs ?? []).map((f: { professional_id: string }) => f.professional_id);
  if (ids.length === 0) return [];
  const { data, error } = await client.from("professionals_public").select("*").in("id", ids);
  if (error || !data) return [];
  const ratings = await fetchRatingsMap(client, data.map((p) => p.id));
  return data.map((p) => ({
    ...p,
    average_rating: ratings[p.id]?.average_rating ?? null,
    review_count: ratings[p.id]?.review_count ?? 0,
  }));
}

export async function addFavorite(userId: string, professionalId: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("favorites").insert({ user_id: userId, professional_id: professionalId });
  if (error) throw error;
}

export async function removeFavorite(userId: string, professionalId: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("professional_id", professionalId);
  if (error) throw error;
}

// --- Pagamento por contato (pay-per-lead) ---------------------------------

/** Saldo de créditos de contato do próprio anúncio (só o dono enxerga). */
export async function getLeadCredits(professionalId: string): Promise<LeadCredits | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.from("lead_credits").select("*").eq("professional_id", professionalId).maybeSingle();
  return data ?? null;
}

/**
 * Se `contact_mode = 'pay_per_lead'`, indica publicamente (sem expor o
 * saldo exato) se há créditos disponíveis — usado para habilitar/esconder o
 * botão de WhatsApp na página do profissional.
 */
export async function hasLeadBalance(professionalId: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data } = await client
    .from("lead_credits_public")
    .select("has_balance")
    .eq("professional_id", professionalId)
    .maybeSingle();
  return !!data?.has_balance;
}

/**
 * Tenta consumir 1 crédito de contato antes de abrir o link do WhatsApp
 * (RPC `security definer`, evita condição de corrida). Retorna true se
 * conseguiu debitar (o profissional tinha saldo), false caso contrário.
 */
export async function consumeLeadCredit(professionalId: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data, error } = await client.rpc("consume_lead_credit", { professional_id: professionalId });
  if (error) return false;
  return !!data;
}

/** Total de leads (contatos cobrados) já gerados para o anúncio — analytics do Plus. */
export async function countLeadEvents(professionalId: string): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const { count } = await client
    .from("lead_events")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId);
  return count ?? 0;
}

export async function updateContactMode(professionalId: string, contactMode: Professional["contact_mode"]) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("professionals").update({ contact_mode: contactMode }).eq("id", professionalId);
  if (error) throw error;
}

// --- Banner de categoria patrocinada --------------------------------------

/** Patrocínio ativo (status='active' e dentro do período) para uma categoria+cidade, se houver. */
export async function getActiveSponsorship(
  category: string,
  city: string
): Promise<(CategorySponsorship & { professional: Professional }) | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client
    .from("category_sponsorships")
    .select("*")
    .eq("category", category)
    .eq("city", city)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  // `professionals_public` não tem FK conhecida por embedding do
  // PostgREST (é uma view), então busca o profissional numa segunda query.
  const { data: professional } = await client
    .from("professionals_public")
    .select("*")
    .eq("id", data.professional_id)
    .maybeSingle();
  if (!professional) return null;
  return { ...(data as CategorySponsorship), professional: professional as Professional };
}

/** Histórico de patrocínios do próprio anúncio, para o painel do profissional. */
export async function getMySponsorships(professionalId: string): Promise<CategorySponsorship[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("category_sponsorships")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// --- Empresa Plus (analytics) ---------------------------------------------

/** Total de visualizações de perfil já registradas — analytics do Plus. */
export async function countProfileViews(professionalId: string): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const { count } = await client
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId);
  return count ?? 0;
}

/**
 * Visualizações dos últimos 30 dias.
 *
 * Diferente do total acima, esta contagem é **grátis para todo anunciante**,
 * não só para quem assina o Plus: saber que 40 pessoas viram seu anúncio no
 * último mês é o que faz alguém entender que o cadastro está valendo a pena.
 * Trancar isso atrás de uma assinatura afastaria justamente quem ainda está
 * decidindo se fica. O Plus continua valendo pelo resto (histórico completo,
 * leads, evolução).
 */
export async function countRecentProfileViews(professionalId: string, days = 30): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await client
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .gte("viewed_at", since);
  return count ?? 0;
}

// --- Pedidos de contato ----------------------------------------------------

/**
 * O caminho inverso do WhatsApp: em vez de a pessoa correr atrás, ela deixa o
 * número e pede para ser chamada. Não exige login de propósito — quem está
 * com um cano estourado em casa não vai criar conta antes de pedir ajuda.
 */
export async function requestContact(input: {
  professional_id: string;
  requester_id: string | null;
  name: string;
  phone: string;
  message: string;
}): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("contact_requests").insert(input);
  if (error) throw error;
}

/** Pedidos recebidos por um anúncio. Arquivados ficam de fora por padrão. */
export async function getContactRequests(
  professionalId: string,
  { includeArchived = false } = {}
): Promise<ContactRequest[]> {
  const client = supabase();
  if (!client) return [];
  let query = client
    .from("contact_requests")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });
  if (!includeArchived) query = query.neq("status", "archived");
  const { data } = await query;
  return data ?? [];
}

export async function updateContactRequestStatus(
  requestId: string,
  status: ContactRequestStatus
): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client
    .from("contact_requests")
    .update({
      status,
      // Guarda quando o retorno aconteceu; voltar para "novo" limpa a marca.
      contacted_at: status === "contacted" ? new Date().toISOString() : null,
    })
    .eq("id", requestId);
  if (error) throw error;
}

/**
 * Cidades que realmente têm anúncio publicado.
 *
 * O filtro da busca usava uma lista fixa no código, então oferecia cidades
 * vizinhas onde ninguém anunciou ainda — quem escolhesse uma delas via uma
 * tela vazia sem entender por quê. Aqui a lista nasce dos cadastros: só
 * aparece cidade onde há alguém para encontrar.
 *
 * O formulário do anúncio continua com a lista fixa, e tem que ser assim:
 * lá a pessoa precisa poder escolher uma cidade que ainda não existe na base
 * — é ela quem estreia a cidade.
 */
export async function getCidadesComAnuncio(): Promise<string[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("professionals_public").select("city");
  if (!data) return [];
  const unicas = new Set<string>();
  for (const linha of data) {
    if (linha.city) unicas.add(linha.city as string);
  }
  return [...unicas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Serviços que realmente têm alguém anunciando.
 *
 * Mesma regra das cidades, e agora com um motivo a mais: quem não se encontra
 * na lista sugerida escreve o próprio serviço no anúncio. Se o filtro
 * continuasse preso à lista fixa do código, esse serviço escrito à mão
 * existiria no cadastro e não existiria na busca — a pessoa pagaria para ficar
 * invisível.
 *
 * Lê `categories` (a lista completa do anúncio), não `category`: quem faz
 * encanamento e elétrica tem que aparecer nos dois filtros.
 */
export async function getCategoriasComAnuncio(): Promise<string[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("professionals_public").select("categories");
  if (!data) return [];
  const unicas = new Set<string>();
  for (const linha of data) {
    for (const c of (linha.categories as string[] | null) ?? []) {
      if (c) unicas.add(c);
    }
  }
  return [...unicas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
