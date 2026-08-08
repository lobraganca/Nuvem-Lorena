import { supabase } from "./supabase";
import type { Suggestion, SuggestionStatus } from "../types/domain";

/**
 * Canal de sugestões gerais sobre a plataforma (feedback de produto, ideias
 * como "poderia ter tal categoria" etc) — diferente de `reportProfessional`
 * (denúncia sobre um anúncio específico). Não exige login: `userId` é
 * `null` quando o visitante não está autenticado.
 */
export async function sendSuggestion(message: string, userId: string | null): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("suggestions").insert({ message, user_id: userId });
  if (error) throw error;
}

/** Lista todas as sugestões (mais recentes primeiro) — só admin enxerga (RLS). */
export async function listSuggestions(): Promise<Suggestion[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client.from("suggestions").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function updateSuggestionStatus(suggestionId: string, status: SuggestionStatus): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("suggestions").update({ status }).eq("id", suggestionId);
  if (error) throw error;
}
