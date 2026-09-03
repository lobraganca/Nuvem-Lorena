import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase deste app (marketplace de profissionais).
 *
 * Este app é independente do Avena — cada um tem seu próprio projeto Supabase
 * (URL/anon key diferentes), então este arquivo não deve ser confundido com
 * src/lib/supabase.ts da raiz do repositório.
 *
 * As duas variáveis abaixo são públicas por natureza: a anon key sozinha não
 * abre nada, pois toda leitura/escrita passa pelas policies de RLS definidas
 * em supabase/migrations/*.sql. A service_role key NUNCA deve entrar aqui —
 * ela é usada somente dentro das Edge Functions (backend).
 */
// `trim()` porque copiar/colar no celular arrasta espaço e quebra de linha
// com muita facilidade — e uma chave com "\n" no fim é recusada pelo
// servidor sem nenhuma mensagem clara.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/**
 * Diz o que está errado na configuração, em vez de só "não tem banco".
 *
 * Antes isto era um booleano: com a chave errada o app parecia configurado
 * e falhava em silêncio — o login criava a conta no servidor e nunca
 * entrava, sem nada na tela explicando. Agora a própria tela conta.
 */
export function problemaDeConfiguracao(): string | null {
  if (!url && !key) return "Faltam o endereço e a chave do Supabase.";
  if (!url) return "Falta o endereço do Supabase (VITE_SUPABASE_URL).";
  if (!key) return "Falta a chave do Supabase (VITE_SUPABASE_ANON_KEY).";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return `O endereço do Supabase parece errado: "${url}". Ele deve ser algo como https://seuprojeto.supabase.co`;
  }
  if (key.length < 30) {
    return "A chave do Supabase parece incompleta — confira se foi colada inteira.";
  }
  return null;
}

/** Endereço e chave, para quem precisa falar com o Supabase fora do cliente
 *  (a tela de configurações consulta as Edge Functions diretamente). */
export function credenciaisSupabase(): { url: string; key: string } {
  return { url, key };
}

export function hasDatabase(): boolean {
  return problemaDeConfiguracao() === null;
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasDatabase()) return null;
  if (!client) {
    try {
      client = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    } catch (err) {
      // createClient lança com valores malformados. Sem este try, a exceção
      // sobe no meio da renderização e o app vira uma tela branca — que não
      // diz nada a quem está tentando configurar.
      console.error("Falha ao criar o cliente Supabase:", err);
      return null;
    }
  }
  return client;
}
