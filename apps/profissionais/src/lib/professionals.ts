import { supabase } from "./supabase";
import type {
  CategorySponsorship,
  ContactRequest,
  ContactRequestStatus,
  LeadCredits,
  Professional,
  Review,
  ServicoOferecido,
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

/** Conta premium só conta se `verified` estiver true E não tiver expirado. */
export function isCurrentlyVerified(p: Pick<Professional, "verified" | "verified_until">): boolean {
  return !!p.verified && (!p.verified_until || new Date(p.verified_until) > new Date());
}

/** Cadastro turbinado só conta se `boosted` estiver true E não tiver expirado. */
export function isCurrentlyBoosted(p: Pick<Professional, "boosted" | "boosted_until">): boolean {
  return !!p.boosted && (!p.boosted_until || new Date(p.boosted_until) > new Date());
}

/** Empresa Plus só conta se `plus_active` estiver true E não tiver expirado. */
export function isCurrentlyPlusActive(p: Pick<Professional, "plus_active" | "plus_until">): boolean {
  return !!p.plus_active && (!p.plus_until || new Date(p.plus_until) > new Date());
}

/**
 * Busca profissionais com filtros de cidade/categoria/texto. Cadastros
 * turbinados vêm primeiro, em ordem sorteada a cada busca (ver rodízio
 * abaixo); os demais, do mais novo para o mais antigo.
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

  /* A view pública não devolve mais suspensos nem pausados (migration
     0053), então o painel administrativo — que existe justamente para
     olhar quem está fora do ar — lê a tabela direto. Não é um furo: na
     tabela vale a RLS, que deixa admin ver tudo e devolve zero linha para
     qualquer outra pessoa. Se alguém chamar esta função com
     `onlySuspended` sem ser admin, recebe uma lista vazia. */
  const fonte = filters.onlySuspended ? "professionals" : "professionals_public";

  let query = client
    .from(fonte)
    .select("*")
    .order("boosted", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.city) query = query.eq("city", filters.city);
  // Casa com qualquer um dos serviços do cadastro, não só o principal.
  if (filters.category) query = query.contains("categories", [filters.category]);
  if (filters.text) {
    // `category` entra junto com nome e descrição: quem digita "eletricista"
    // no campo de busca espera encontrar os eletricistas, e não só quem tem
    // a palavra escrita no nome ou no texto do cadastro. Sem isto, o campo
    // principal do app falhava justamente na busca mais óbvia — e a pessoa
    // concluía que não havia eletricista na cidade.
    //
    // `especialidade` entra pelo mesmo motivo, um nível abaixo: quem digita
    // "ortodontista" não está procurando "dentista", está procurando aquilo.
    // Sem este campo na busca, a especialidade apareceria no cadastro e não
    // serviria para achar ninguém.
    const t = filters.text.replace(/[%,()]/g, " ").trim();
    query = query.or(
      `name.ilike.%${t}%,bio.ilike.%${t}%,category.ilike.%${t}%,especialidade.ilike.%${t}%`
    );
  }
  if (filters.onlySuspended) query = query.eq("suspended", true);

  /* Busca que falha não é busca vazia.
     Devolver `[]` aqui fazia a tela dizer "nenhum resultado" com cara de
     normal sempre que o banco recusasse a consulta — policy nova, coluna
     renomeada, rede caída. Foi assim que a exigência de CPF nas avaliações
     passou semanas invisível: a tela mentia com calma. Aqui é pior, porque
     é a função principal do app: a pessoa concluiria que não existe
     eletricista em Itabirito. O erro sobe e quem chamou decide o que
     mostrar. */
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

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

  /**
   * Rodízio entre os cadastros turbinados.
   *
   * O banco devolve turbinados primeiro e, dentro deles, os mais recentes —
   * o que na prática dá o topo a quem assinou por último e empurra para
   * baixo quem paga há meses. Com dez eletricistas turbinados na mesma
   * cidade, os últimos da fila pagam e não aparecem; é o tipo de coisa que
   * ninguém reclama, só cancela.
   *
   * Embaralhar a cada busca reparte o topo entre todos que pagaram. Não é
   * sorteio de quem aparece — todos aparecem antes dos não-turbinados —, é
   * sorteio da ordem entre eles.
   *
   * Só vale para a ordenação padrão: quem pediu "melhor avaliado" quer nota,
   * e dinheiro não pode reordenar uma lista que a pessoa mandou ordenar por
   * outro critério.
   */
  if (!filters.sort || filters.sort === "relevance") {
    const turbinados = results.filter((p) => isCurrentlyBoosted(p));
    const demais = results.filter((p) => !isCurrentlyBoosted(p));
    for (let i = turbinados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turbinados[i], turbinados[j]] = [turbinados[j], turbinados[i]];
    }
    results = [...turbinados, ...demais];
  }

  if (filters.sort === "rating") {
    results = [...results].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
  } else if (filters.sort === "reviews") {
    results = [...results].sort((a, b) => b.review_count - a.review_count);
  }

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
    // `reviews_public` em vez de `reviews`: é ela que traz o nome e a foto de
    // quem avaliou, juntando com o perfil público. A tabela crua não tem
    // como — `profiles` só é legível pelo próprio dono, para o CPF não vazar.
    .from("reviews_public")
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
/**
 * Registra que alguém pediu o contato deste profissional.
 *
 * Alimenta a etiqueta "avaliação de quem chamou". É best-effort de
 * propósito: se falhar, a pessoa ainda liga, ainda contrata e ainda avalia —
 * só perde a etiqueta. Nada aqui pode ficar entre ela e o telefone.
 */
export async function registrarContato(
  professionalId: string,
  userId: string | null,
  tipo: "whatsapp" | "telefone" | "pedido"
): Promise<void> {
  const client = supabase();
  if (!client) return;
  try {
    await client.from("contatos_registrados").insert({
      professional_id: professionalId,
      user_id: userId,
      tipo,
    });
  } catch {
    /* silencioso: contato registrado é bônus, não requisito */
  }
}

export async function addReview(input: {
  professional_id: string;
  user_id: string;
  rating: number;
  tags: string[];
  comment: string;
  contratou: boolean;
}) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reviews").upsert(input, { onConflict: "professional_id,user_id" });
  if (error) throw error;
  // Aviso ao dono do cadastro é best-effort: nunca deve derrubar o fluxo de
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
export async function updateReview(
  reviewId: string,
  input: { rating: number; tags: string[]; comment: string; contratou: boolean }
) {
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

/** Dono do cadastro responde a uma avaliação recebida. RLS garante que só o dono pode. */
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
 * Cria ou atualiza um cadastro. Em update (input.id presente), remove
 * `photo_url` do payload quando ele não foi explicitamente informado (ex:
 * `undefined`), para não sobrescrever a foto já salva com `null` só porque o
 * usuário editou outros campos sem trocar a foto — quem chama deve passar
 * `photo_url: null` explicitamente só se realmente quiser apagar a foto.
 */
/**
 * Um cadastro para abrir na tela de edição.
 *
 * Lê a tabela, não a view pública: a view esconde suspensos e pausados
 * (0053), e são justamente esses que mais precisam ser abertos — o dono
 * para entender o que houve, a administração para corrigir.
 *
 * Quem pode ver o quê é decidido pelo banco, não por esta função nem pela
 * tela. As policies de `professionals` deixam passar o dono ("dono vê o
 * próprio anúncio mesmo suspenso") e quem está em `admins` ("admin vê
 * qualquer anúncio"). Para todo o resto, a consulta volta vazia e a tela
 * trata como cadastro inexistente. É a diferença entre esconder o botão e
 * fechar a porta: aqui está fechada.
 */
export async function getProfessionalParaEditar(id: string): Promise<Professional | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.from("professionals").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * Cria ou atualiza um cadastro.
 *
 * Cadastro que já tem `id` vai por `update`, não por `upsert`, e a
 * diferença não é de estilo — é o que faz a edição pela administração
 * existir.
 *
 * O Postgres executa `upsert` como INSERT com "se já existir, atualize", e
 * a RLS avalia a regra de INSERT: `with check (auth.uid() = owner_id)`, ou
 * seja, só dá para inserir cadastro que é seu. Quem edita o cadastro de
 * outra pessoa esbarra ali mesmo tendo permissão de update — a regra que
 * autoriza a administração é a de UPDATE, e o upsert nunca chega a
 * acioná-la. O banco recusava, e a tela dizia "saia da conta e entre de
 * novo", que não tinha nada a ver.
 *
 * Indo por `update`, valem as regras de update: o dono edita o que é dele,
 * a administração edita qualquer um. Cada caminho passa pela porta que
 * existe para ele.
 *
 * `owner_id` fica de fora da atualização de propósito. Ele não muda quando
 * se edita um cadastro, e não mandá-lo é a garantia, na camada dos dados,
 * de que nenhuma tela consegue transferir o cadastro de alguém para outra
 * conta por engano.
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

  if (payload.id) {
    const { id, owner_id: _dono, ...campos } = payload;
    const { data, error } = await client
      .from("professionals")
      .update(campos)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await client.from("professionals").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Apaga um cadastro do dono logado.
 *
 * Quem decide se pode é o banco: a policy de delete exige que `owner_id` seja
 * quem está pedindo, então mandar o id de um cadastro alheio não apaga nada —
 * a checagem não depende de a tela ter escondido o botão.
 *
 * O efeito em cascata vem do schema: avaliações, favoritos, créditos e
 * pedidos de contato referenciam o cadastro e caem junto. É por isso que a
 * tela pede confirmação — some também a reputação construída.
 */
/**
 * Liga e desliga a pausa do próprio cadastro.
 *
 * Separado de `upsertProfessional` porque é um gesto de um toque, e não a
 * gravação de um formulário: mandar o cadastro inteiro de volta ao banco só
 * para mudar um booleano abriria espaço para sobrescrever, com dados velhos
 * da tela, algo que mudou no meio do caminho.
 */
export async function setProfessionalPaused(id: string, paused: boolean): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.from("professionals").update({ paused }).eq("id", id);
  if (error) throw error;
}

export async function deleteProfessional(id: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.from("professionals").delete().eq("id", id);
  if (error) throw error;
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

/** Saldo de créditos de contato do próprio cadastro (só o dono enxerga). */
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

/**
 * Total de pedidos de contato recebidos — quem deixou o número pedindo
 * retorno. É a métrica que substituiu a contagem de "leads": aquela só
 * crescia no modo de pagar por contato, que foi aposentado, e por isso
 * mostrava zero para todo mundo desde então.
 */
export async function countContactRequests(professionalId: string): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const { count } = await client
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId);
  return count ?? 0;
}

/** Total de leads (contatos cobrados) já gerados para o cadastro — analytics do Plus. */
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

/**
 * Patrocínio ativo (status='active' e dentro do período) para uma
 * categoria+cidade, se houver.
 *
 * **Hoje sem nenhum chamador.** O cartão que a mostrava vivia na busca e
 * saiu junto com o resto da publicidade: a busca é onde a pessoa está
 * resolvendo um problema, e ali nada que foi pago para aparecer disputa
 * com o que ela veio fazer. Não há tela de compra deste produto no app —
 * ele só nasce pela administração —, então nada ficou vendido sem
 * entrega.
 *
 * Fica de pé porque a tabela continua existindo, o financeiro do admin
 * ainda soma "Patrocínio de categoria", e o lugar natural de o produto
 * voltar é a tela de anúncios, onde quem entra já entrou para ver quem
 * pagou para aparecer.
 */
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

/** Histórico de patrocínios do próprio cadastro, para o painel do profissional. */
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
 * não só para quem assina o Plus: saber que 40 pessoas viram seu cadastro no
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

/** Teto de linhas lidas de uma vez ao contar visitas de vários cadastros. */
const TETO_VISITAS_EM_LOTE = 5000;

/**
 * As visitas de vários cadastros numa consulta só.
 *
 * Contar de um em um custava duas idas ao banco por cadastro (30 dias e 7
 * dias), e o painel de quem tem três cadastros abria com seis só para esse
 * número. Aqui as linhas do período vêm juntas e a soma é feita aqui.
 *
 * O teto existe porque a resposta traz linha por visita, não um total: se
 * um dia a cidade gerar mais visitas do que cabe numa resposta, somar o que
 * veio daria um número menor que o real — e número errado num painel é pior
 * que número demorado. Quando o teto é alcançado, cada cadastro volta a ser
 * contado pelo caminho exato, que conta no servidor e não traz linha
 * nenhuma.
 */
export async function countRecentProfileViewsDeVarios(
  professionalIds: string[],
  days = 30
): Promise<Record<string, number>> {
  const totais: Record<string, number> = {};
  for (const id of professionalIds) totais[id] = 0;

  const client = supabase();
  if (!client || professionalIds.length === 0) return totais;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("profile_views")
    .select("professional_id")
    .in("professional_id", professionalIds)
    .gte("viewed_at", since)
    .limit(TETO_VISITAS_EM_LOTE);

  if (error || !data || data.length >= TETO_VISITAS_EM_LOTE) {
    const pares = await Promise.all(
      professionalIds.map(async (id) => [id, await countRecentProfileViews(id, days)] as const)
    );
    return Object.fromEntries(pares);
  }

  for (const linha of data as { professional_id: string }[]) {
    totais[linha.professional_id] = (totais[linha.professional_id] ?? 0) + 1;
  }
  return totais;
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

/** Pedidos recebidos por um cadastro. Arquivados ficam de fora por padrão. */
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

/**
 * Os pedidos de contato de vários cadastros numa consulta só.
 *
 * Mesma história das assinaturas e das visitas: o painel percorria os
 * cadastros pedindo um por um. Quem lê continua sendo filtrado pelo RLS —
 * "dono vê os pedidos do próprio anúncio" (migration 0022) —, então pedir
 * por uma lista de ids não amplia o que volta.
 */
export async function getContactRequestsDeVarios(
  professionalIds: string[],
  { includeArchived = false } = {}
): Promise<Record<string, ContactRequest[]>> {
  const porCadastro: Record<string, ContactRequest[]> = {};
  for (const id of professionalIds) porCadastro[id] = [];

  const client = supabase();
  if (!client || professionalIds.length === 0) return porCadastro;

  let query = client
    .from("contact_requests")
    .select("*")
    .in("professional_id", professionalIds)
    .order("created_at", { ascending: false });
  if (!includeArchived) query = query.neq("status", "archived");

  const { data } = await query;
  for (const pedido of (data ?? []) as ContactRequest[]) {
    (porCadastro[pedido.professional_id] ??= []).push(pedido);
  }
  return porCadastro;
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
 * Cidades que realmente têm cadastro publicado.
 *
 * O filtro da busca usava uma lista fixa no código, então oferecia cidades
 * vizinhas onde ninguém anunciou ainda — quem escolhesse uma delas via uma
 * tela vazia sem entender por quê. Aqui a lista nasce dos cadastros: só
 * aparece cidade onde há alguém para encontrar.
 *
 * O formulário do cadastro continua com a lista fixa, e tem que ser assim:
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
 * na lista sugerida escreve o próprio serviço no cadastro. Se o filtro
 * continuasse preso à lista fixa do código, esse serviço escrito à mão
 * existiria no cadastro e não existiria na busca — a pessoa pagaria para ficar
 * invisível.
 *
 * Lê `categories` (a lista completa do cadastro), não `category`: quem faz
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

export interface CategoriaPopular {
  categoria: string;
  /** Quantos cadastros atendem essa categoria hoje — autônomos e empresas. */
  quantidade: number;
}

/**
 * Todas as categorias com gente cadastrada, com a contagem de cada uma.
 *
 * É a lista inteira, sem corte: serve a tela de "todas as categorias", que
 * existe justamente para quem não achou o ofício nas oito vagas da grade
 * da busca.
 *
 * Continua saindo dos cadastros, e não da lista fixa do código. São coisas
 * diferentes: `CATEGORIES` é o que dá para escolher ao se cadastrar, e isto
 * é o que a cidade tem hoje. Mostrar a lista fixa aqui encheria a tela de
 * ofícios sem ninguém para atender — e cada um deles é um toque que termina
 * em "não achamos ninguém".
 */
export async function getTodasAsCategorias(): Promise<CategoriaPopular[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("professionals_public").select("categories");
  if (!data) return [];
  const contagem = new Map<string, number>();
  for (const linha of data) {
    for (const c of (linha.categories as string[] | null) ?? []) {
      if (c) contagem.set(c, (contagem.get(c) ?? 0) + 1);
    }
  }
  return [...contagem.entries()]
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
}

/**
 * As categorias mais comuns, para a grade de atalhos da tela de busca.
 *
 * "Mais comuns" não é opinião: é a contagem real de quem está cadastrado.
 * Não existe registro de termo mais buscado (a busca por texto não é
 * gravada em lugar nenhum), então usar o que tem gente para atender de
 * verdade é o proxy honesto — sugerir uma categoria vazia devolveria "não
 * achamos ninguém" no primeiro toque.
 *
 * ## Por que o comércio precisa de um empurrão
 *
 * Ordenada só pela contagem, a grade vira uma lista de autônomos: eles são
 * a maioria dos cadastros, e as oito vagas acabam antes de a primeira
 * farmácia aparecer. O comércio da cidade some da tela de entrada.
 *
 * A correção não é separar em duas grades — isso já foi tentado e partiu a
 * tela em dois pedaços curtos, cada um com título e sobra de linha. Aqui as
 * categorias são classificadas por quem é maioria dentro delas ("Farmácia"
 * é coisa de empresa, "Pedreiro" é coisa de autônomo) e as duas filas são
 * intercaladas. Sai uma grade só, visualmente igual à de antes, em que o
 * comércio tem vaga garantida em vez de disputar com quem é mais numeroso.
 *
 * O número é sempre o total da categoria, sem recorte de tipo: é ele que
 * vai aparecer escrito no cartão, e tocar no cartão filtra só pela
 * categoria. Contar de um jeito e buscar de outro faria o cartão prometer
 * um tanto de gente e a lista entregar outro.
 */
export async function getCategoriasPopulares(limite = 8): Promise<CategoriaPopular[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("professionals_public").select("categories, entity_type");
  if (!data) return [];

  const total = new Map<string, number>();
  const dePj = new Map<string, number>();
  for (const linha of data) {
    for (const c of (linha.categories as string[] | null) ?? []) {
      if (!c) continue;
      total.set(c, (total.get(c) ?? 0) + 1);
      if (linha.entity_type === "pj") dePj.set(c, (dePj.get(c) ?? 0) + 1);
    }
  }

  const porQuantidade = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR");
  const entradas = [...total.entries()].sort(porQuantidade);
  // Empatou? Conta como comércio: são eles que precisam da vaga reservada.
  const eDeEmpresa = (c: string) => (dePj.get(c) ?? 0) * 2 >= (total.get(c) ?? 0);

  const filas = {
    empresas: entradas.filter(([c]) => eDeEmpresa(c)),
    profissionais: entradas.filter(([c]) => !eDeEmpresa(c)),
  };

  /* Intercala uma de cada, começando pelos autônomos porque são o que a
     maioria vem procurar. Quando uma fila acaba, a outra preenche o resto —
     uma cidade sem comércio cadastrado continua com a grade cheia. */
  const escolhidas: [string, number][] = [];
  for (let i = 0; escolhidas.length < limite; i++) {
    const antes = escolhidas.length;
    if (filas.profissionais[i]) escolhidas.push(filas.profissionais[i]);
    if (escolhidas.length < limite && filas.empresas[i]) escolhidas.push(filas.empresas[i]);
    if (escolhidas.length === antes) break; // as duas filas acabaram
  }

  return escolhidas.map(([categoria, quantidade]) => ({ categoria, quantidade }));
}

/**
 * Catálogo de serviços de um cadastro.
 *
 * Leitura pública (é catálogo, existe para ser visto); escrita só do dono,
 * conferida pelo banco — a policy exige que o cadastro seja dele, então
 * mandar o id de um cadastro alheio não grava nada.
 */
export async function getCatalogo(professionalId: string): Promise<ServicoOferecido[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("servicos_oferecidos")
    .select("*")
    .eq("professional_id", professionalId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function salvarServicoDoCatalogo(input: {
  id?: string;
  professional_id: string;
  nome: string;
  descricao: string;
  ordem: number;
}): Promise<ServicoOferecido> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.from("servicos_oferecidos").upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function apagarServicoDoCatalogo(id: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("servicos_oferecidos").delete().eq("id", id);
  if (error) throw error;
}
