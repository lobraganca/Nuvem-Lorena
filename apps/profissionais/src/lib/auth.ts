import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Login via Google, usando o provider OAuth "google" já habilitado no
 * projeto Supabase (Authentication > Providers > Google). O redirect volta
 * para a própria origem — em produção, cadastre a URL de callback no console
 * do Google Cloud e no Supabase.
 */
/**
 * Onde a pessoa estava quando pediu para entrar.
 *
 * O `redirectTo` do OAuth só é respeitado se a URL estiver na lista de
 * endereços permitidos do projeto Supabase; fora dela, o Supabase devolve
 * todo mundo na raiz do site, calado. Ou seja: uma configuração no painel
 * decidia se a pessoa voltava para o Painel ou para a busca.
 *
 * Guardar o destino no próprio aparelho tira essa decisão do meio: o app
 * volta para onde a pessoa estava mesmo quando o retorno cai na raiz.
 */
const CHAVE_DESTINO = "busca-itabirito-destino-login";

export function guardarDestinoLogin(caminho: string): void {
  try {
    window.localStorage.setItem(CHAVE_DESTINO, caminho);
  } catch {
    /* sem armazenamento, resta o redirectTo — melhor do que quebrar o login */
  }
}

/** Lê e apaga o destino: ele vale para uma volta só. */
export function consumirDestinoLogin(): string | null {
  try {
    const destino = window.localStorage.getItem(CHAVE_DESTINO);
    if (destino) window.localStorage.removeItem(CHAVE_DESTINO);
    return destino;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(voltarPara?: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado (VITE_SUPABASE_URL/ANON_KEY ausentes).");
  // Sem `voltarPara`, o Google devolvia todo mundo na raiz do site. Quem
  // clicava em "Quero ser encontrado" e entrava com a conta reaparecia na
  // tela de busca, sem o formulário do anúncio e sem entender o que tinha
  // acontecido — a impressão é de que o login deu errado.
  if (voltarPara) guardarDestinoLogin(voltarPara);
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
