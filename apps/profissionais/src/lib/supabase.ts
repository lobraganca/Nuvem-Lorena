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
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function hasDatabase(): boolean {
  return Boolean(url && key);
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasDatabase()) return null;
  if (!client) {
    client = createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
