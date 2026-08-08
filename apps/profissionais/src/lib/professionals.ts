import { supabase } from "./supabase";
import type { Favorite, Professional, Review } from "../types/domain";

export type SortOption = "relevance" | "rating" | "reviews";

export interface SearchFilters {
  city?: string;
  category?: string;
  text?: string;
  minRating?: number;
  sort?: SortOption;
}

export interface ProfessionalWithRating extends Professional {
  average_rating: number | null;
  review_count: number;
}

/**
 * Busca profissionais com filtros de cidade/categoria/texto, ordenando
 * anúncios turbinados primeiro (e, dentro de cada grupo, os mais novos).
 * Sem banco configurado, devolve uma lista vazia — as telas tratam isso como
 * "nenhum resultado" em vez de quebrar.
 */
export async function searchProfessionals(filters: SearchFilters): Promise<ProfessionalWithRating[]> {
  const client = supabase();
  if (!client) return [];

  let query = client.from("professionals").select("*").order("boosted", { ascending: false }).order("created_at", { ascending: false });

  if (filters.city) query = query.eq("city", filters.city);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.text) {
    query = query.or(`name.ilike.%${filters.text}%,bio.ilike.%${filters.text}%`);
  }

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
  const { data, error } = await client.from("professionals").select("*").eq("id", id).single();
  if (error || !data) return null;
  const ratings = await fetchRatingsMap(client, [id]);
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

export async function addReview(input: { professional_id: string; user_id: string; rating: number; comment: string }) {
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

/** Autor edita a própria avaliação (rating/comment). RLS garante que só o autor pode. */
export async function updateReview(reviewId: string, input: { rating: number; comment: string }) {
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

export async function upsertProfessional(input: Partial<Professional> & { owner_id: string }): Promise<Professional> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (input.document && (await isDocumentBanned(input.document))) {
    throw new Error("Este CPF/CNPJ está impedido de se cadastrar na plataforma.");
  }
  const { data, error } = await client.from("professionals").upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function reportProfessional(input: {
  professional_id: string;
  reporter_id: string | null;
  reason: string;
  details: string;
}) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reports").insert({
    professional_id: input.professional_id,
    reporter_id: input.reporter_id,
    reason: input.reason,
    details: input.details || null,
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
  const { data, error } = await client.from("professionals").select("*").in("id", ids);
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
