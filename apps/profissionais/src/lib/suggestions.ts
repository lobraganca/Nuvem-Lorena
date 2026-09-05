import { supabase } from "./supabase";
import type { Suggestion, SuggestionStatus } from "../types/domain";

/**
 * Canal de sugestões gerais sobre a plataforma (feedback de produto, ideias
 * como "poderia ter tal categoria" etc) — diferente de `reportProfessional`
 * (denúncia sobre um cadastro específico). Não exige login: `userId` é
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
  /* Sem cliente do Supabase, o erro SOBE — nunca vira lista vazia.
     ─────────────────────────────────────────────────────────────────
     "Nenhum profissional em Itabirito" e "a build subiu sem saber com
     qual banco falar" são a MESMA tela e coisas opostas. Aconteceu em
     31/08: o site passou o dia dizendo que a cidade estava vazia porque
     as variáveis de ambiente não foram assadas na build. Ninguém
     percebeu, porque uma lista vazia não parece defeito.

     Aqui não há nenhum caso legítimo de lista vazia: `!sb` quer dizer
     que o app não tem como falar com banco nenhum. */
  if (!client) throw new Error("Sem conexão com o banco.");
  const { data, error } = await client.from("suggestions").select("*").order("created_at", { ascending: false });
  /* ── O ERRO SOBE, E NÃO VIRA LISTA VAZIA — 05/09 ────────────────────
     Era `if (error || !data) return []`. O comentário logo acima explica,
     desde sempre, por que isso é errado — e a linha abaixo dele fazia
     exatamente aquilo. Achado varrendo o app.

     O efeito: uma policy nova, uma coluna renomeada ou a rede caída
     faziam o painel dizer "nenhuma sugestão recebida ainda" com cara de
     normal. É a mesma mentira calma que a lista de denúncias tinha, e
     que este projeto já pagou caro em outros lugares.

     `!data` continua devolvendo vazio: sem erro e sem linhas quer dizer,
     de verdade, que ninguém sugeriu nada. */
  if (error) throw error;
  return data ?? [];
}

export async function updateSuggestionStatus(suggestionId: string, status: SuggestionStatus): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("suggestions").update({ status }).eq("id", suggestionId);
  if (error) throw error;
}
