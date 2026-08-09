import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";
import { origemCanonica } from "./enderecoCanonico";

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

/**
 * O destino vale por 10 minutos.
 *
 * Quem abre o login e desiste no meio deixaria um destino guardado para
 * sempre — e ele silencia a tela de início em toda visita seguinte, porque
 * ela não redireciona ninguém enquanto houver login em andamento. Um login
 * que não terminou em 10 minutos não vai terminar.
 */
const VALIDADE_MS = 10 * 60 * 1000;

export function guardarDestinoLogin(caminho: string): void {
  try {
    window.localStorage.setItem(CHAVE_DESTINO, JSON.stringify({ caminho, em: Date.now() }));
  } catch {
    /* sem armazenamento, resta o redirectTo — melhor do que quebrar o login */
  }
}

/**
 * Existe um login em andamento? Diferente de `consumirDestinoLogin`, não
 * apaga nada — serve para outras telas saberem que não devem redirecionar
 * ninguém no meio da volta do Google.
 */
export function temDestinoLogin(): boolean {
  return lerDestino() !== null;
}

function lerDestino(): string | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DESTINO);
    if (!bruto) return null;
    const { caminho, em } = JSON.parse(bruto) as { caminho?: string; em?: number };
    if (!caminho || !em || Date.now() - em > VALIDADE_MS) {
      window.localStorage.removeItem(CHAVE_DESTINO);
      return null;
    }
    return caminho;
  } catch {
    // Formato antigo ou storage bloqueado: descarta em vez de travar a tela
    // de início para sempre.
    try {
      window.localStorage.removeItem(CHAVE_DESTINO);
    } catch {
      /* nada a fazer */
    }
    return null;
  }
}

/** Lê e apaga o destino: ele vale para uma volta só. */
export function consumirDestinoLogin(): string | null {
  const destino = lerDestino();
  try {
    window.localStorage.removeItem(CHAVE_DESTINO);
  } catch {
    /* storage bloqueado */
  }
  return destino;
}

export async function signInWithGoogle(voltarPara?: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado (VITE_SUPABASE_URL/ANON_KEY ausentes).");
  // Sem `voltarPara`, o Google devolvia todo mundo na raiz do site. Quem
  // clicava em "Quero ser encontrado" e entrava com a conta reaparecia na
  // tela de busca, sem o formulário do anúncio e sem entender o que tinha
  // acontecido — a impressão é de que o login deu errado.
  if (voltarPara) guardarDestinoLogin(voltarPara);
  const origem = origemCanonica();
  const destino = voltarPara ? new URL(voltarPara, origem).toString() : origem;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: destino },
  });
  if (error) throw error;
}

/**
 * Login com a conta Apple.
 *
 * Existe por dois motivos. O primeiro é a App Store: a regra 4.8 exige que
 * um app com login de terceiros ofereça também o "Entrar com a Apple" — sem
 * isso, rejeição na primeira revisão. O segundo é quem já usa iPhone e não
 * quer entregar o e-mail: a Apple oferece esconder o endereço real, e parte
 * das pessoas só entra quando pode fazer isso.
 *
 * O caminho é idêntico ao do Google, incluindo a volta ao ponto de partida.
 */
export async function signInWithApple(voltarPara?: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (voltarPara) guardarDestinoLogin(voltarPara);
  const origem = origemCanonica();
  const destino = voltarPara ? new URL(voltarPara, origem).toString() : origem;
  const { error } = await client.auth.signInWithOAuth({
    provider: "apple",
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
