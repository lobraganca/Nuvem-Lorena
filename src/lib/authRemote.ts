import { supabase } from "./supabase";
import type { Account } from "./auth";

/**
 * Contas de verdade, no servidor.
 *
 * A diferença em relação a src/lib/auth.ts não é técnica, é o que a pessoa
 * ganha: a conta deixa de morar num aparelho só. Quem cria a conta no celular
 * entra pelo computador; quem esquece a senha recebe um e-mail e volta; quem
 * troca de telefone não perde as viagens. Nada disso era possível guardando a
 * senha no navegador, e a tela dizia isso em voz alta — agora vai poder parar
 * de dizer.
 *
 * A senha nunca passa por aqui em lugar nenhum que a gente guarde: o
 * Supabase recebe, deriva a chave no servidor dele e devolve só uma sessão.
 */

/** Por que uma tentativa falhou, em termos que a tela sabe explicar. */
export type RemoteAuthError =
  | "ja-existe"
  | "credenciais"
  | "confirme-email"
  | "senha-fraca"
  | "rede";

/**
 * Traduz o erro do Supabase, que vem em inglês e para programador.
 *
 * Note que e-mail inexistente e senha errada caem no mesmo "credenciais", de
 * propósito: se a tela dissesse "essa conta não existe", qualquer pessoa
 * poderia descobrir, um e-mail por vez, quem está cadastrado no Avena.
 */
function traduzir(mensagem: string, status?: number): RemoteAuthError {
  const m = mensagem.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "ja-existe";
  }
  if (m.includes("email not confirmed")) return "confirme-email";
  if (m.includes("password") && (m.includes("short") || m.includes("least"))) {
    return "senha-fraca";
  }
  if (m.includes("invalid login") || status === 400) return "credenciais";
  if (m.includes("fetch") || m.includes("network") || status === undefined) return "rede";
  return "credenciais";
}

/** O que o app chama de conta, montado a partir do usuário do Supabase. */
function paraConta(user: {
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}): Account {
  const meta = user.user_metadata ?? {};
  return {
    name: typeof meta.name === "string" ? meta.name : "",
    email: user.email ?? "",
    // No servidor a senha não vive no navegador. Os dois campos continuam no
    // tipo porque o modo local ainda existe; aqui ficam vazios de propósito.
    passwordHash: "",
    salt: "",
    createdAt: user.created_at ?? new Date().toISOString(),
    phone: typeof meta.phone === "string" ? meta.phone : undefined,
    phoneVerifiedBy:
      meta.phoneVerifiedBy === "servidor" || meta.phoneVerifiedBy === "teste"
        ? meta.phoneVerifiedBy
        : undefined,
    phoneVerifiedAt:
      typeof meta.phoneVerifiedAt === "string" ? meta.phoneVerifiedAt : undefined,
  };
}

export async function remoteSignUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ error: RemoteAuthError | null; account: Account | null; needsEmail: boolean }> {
  const db = supabase();
  if (!db) return { error: "rede", account: null, needsEmail: false };

  const { data, error } = await db.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });

  if (error) {
    return { error: traduzir(error.message, error.status), account: null, needsEmail: false };
  }

  // Sem sessão junto do usuário significa que o projeto exige confirmar o
  // e-mail antes de entrar. A conta existe; falta a pessoa abrir a caixa.
  const needsEmail = Boolean(data.user && !data.session);
  return {
    error: null,
    account: data.user ? paraConta(data.user) : null,
    needsEmail,
  };
}

export async function remoteSignIn(input: {
  email: string;
  password: string;
}): Promise<{ error: RemoteAuthError | null; account: Account | null }> {
  const db = supabase();
  if (!db) return { error: "rede", account: null };

  const { data, error } = await db.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) return { error: traduzir(error.message, error.status), account: null };
  return { error: null, account: data.user ? paraConta(data.user) : null };
}

export async function remoteSignOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

/** A sessão que o navegador já tem guardada, se houver. */
export async function remoteSession(): Promise<Account | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session?.user ? paraConta(data.session.user) : null;
}

/**
 * Avisa quando a sessão muda por fora — o token renovou, ou a pessoa saiu numa
 * outra aba. Devolve a função que cancela a inscrição.
 */
export function onRemoteAuthChange(cb: (account: Account | null) => void): () => void {
  const db = supabase();
  if (!db) return () => {};
  const { data } = db.auth.onAuthStateChange((_evento, session) => {
    cb(session?.user ? paraConta(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Manda o e-mail de redefinição.
 *
 * Devolve sucesso mesmo para endereço que não existe — e isso é intencional,
 * pelo mesmo motivo de "credenciais" acima: a resposta não pode servir para
 * descobrir quem tem conta.
 */
export async function remoteResetPassword(email: string): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  try {
    const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    // Endereço inexistente não é falha aqui — o Supabase responde igual de
    // propósito. Falha é o servidor não ter respondido, e aí a tela não pode
    // dizer que o e-mail está a caminho.
    return !error;
  } catch {
    return false;
  }
}

/**
 * Manda de novo o e-mail de confirmação.
 *
 * Existe porque o primeiro e-mail se perde: cai no spam, a pessoa fecha a aba,
 * o link expira. Sem um botão para reenviar, a única saída seria criar outra
 * conta com outro endereço — e aí o cadastro fica com duas contas pela metade.
 */
export async function remoteResendConfirmation(email: string): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  try {
    const { error } = await db.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.href },
    });
    return !error;
  } catch {
    return false;
  }
}

/** Guarda o telefone confirmado junto da conta, no servidor. */
export async function remoteSetPhone(
  phone: string,
  level: "servidor" | "teste"
): Promise<void> {
  await supabase()?.auth.updateUser({
    data: { phone, phoneVerifiedBy: level, phoneVerifiedAt: new Date().toISOString() },
  });
}
