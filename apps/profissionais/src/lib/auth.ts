import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Login via Google, usando o provider OAuth "google" já habilitado no
 * projeto Supabase (Authentication > Providers > Google). O redirect volta
 * para a própria origem — em produção, cadastre a URL de callback no console
 * do Google Cloud e no Supabase.
 */
export async function signInWithGoogle(voltarPara?: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado (VITE_SUPABASE_URL/ANON_KEY ausentes).");
  // Sem `voltarPara`, o Google devolvia todo mundo na raiz do site. Quem
  // clicava em "Quero ser encontrado" e entrava com a conta reaparecia na
  // tela de busca, sem o formulário do anúncio e sem entender o que tinha
  // acontecido — a impressão é de que o login deu errado.
  const destino = voltarPara ? new URL(voltarPara, window.location.origin).toString() : window.location.origin;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: destino },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const client = supabase();
  if (!client) return;
  await client.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const client = supabase();
  if (!client) {
    callback(null);
    return () => {};
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
