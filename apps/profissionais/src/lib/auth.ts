import { supabase } from "./supabase";
import { ehCelular, onlyPhoneDigits } from "./phone";
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
  // tela de busca, sem o formulário do cadastro e sem entender o que tinha
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

/* ---------------------------------------------------------------------
   Entrar sem o Google: pelo telefone, ou por e-mail e senha.
   ---------------------------------------------------------------------

   O Google era a única porta. Isso deixa de fora quem não tem conta
   Google no celular, quem tem e não lembra a senha, e quem simplesmente
   não quer entrar com ela — e numa cidade pequena essas três somam gente
   demais para o app se dar ao luxo.

   O telefone tem um segundo motivo, que é o principal: ele **é** o dado
   que interessa. Quem entra pelo número já entregou o número, confirmado,
   sem tela extra e sem pedir nada — enquanto quem entra pelo Google
   precisa ser convencido a informá-lo depois.

   Custo: cada código enviado é um SMS pago. Sessão de quem entra dura até
   sair, então é um SMS por aparelho novo, não por acesso.

   **Uma pessoa pode virar três contas.** Maria entrando pelo Google hoje,
   por e-mail amanhã e por telefone depois são três usuários distintos
   para o Auth, cada um com seus favoritos e seus cadastros. O Supabase
   junta sozinho os que compartilham um e-mail verificado (Google e
   e-mail/senha da mesma caixa), mas o telefone não tem e-mail para casar.
   Por isso a mensagem de "número já usado" abaixo é explicativa e não um
   erro seco: é o único aviso que a pessoa vai receber antes de perder o
   acesso ao próprio cadastro. */

/** Manda o código de entrada por SMS. Cria a conta se ainda não existir. */
export async function entrarComTelefone(telefone: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const digitos = onlyPhoneDigits(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error("Confira o número: precisa ter DDD e 8 ou 9 dígitos.");
  }
  /* Fixo não recebe SMS. O provedor aceita o pedido, responde "enviado" e
     cobra; a mensagem não chega porque não há para onde chegar. Sem esta
     checagem, a pessoa fica esperando para sempre um código que ninguém
     mandou — e nada, em tela nenhuma, diz por quê. */
  if (!ehCelular(digitos)) {
    throw new Error("Esse número parece ser de telefone fixo, e o código só chega em celular.");
  }

  const { error } = await client.auth.signInWithOtp({ phone: `+55${digitos}` });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

/** Confere o código e entra. */
export async function conferirCodigoDeEntrada(telefone: string, codigo: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const { error } = await client.auth.verifyOtp({
    phone: `+55${onlyPhoneDigits(telefone)}`,
    token: codigo.trim(),
    // "sms" e não "phone_change": aqui a conta está nascendo (ou voltando),
    // não ganhando um telefone novo. O tipo errado devolve "Token has
    // expired or is invalid" mesmo com o código certo, recém-recebido.
    type: "sms",
  });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

export async function entrarComEmail(email: string, senha: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

export async function criarContaComEmail(email: string, senha: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { error } = await client.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { emailRedirectTo: origemCanonica() },
  });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

export async function recuperarSenha(email: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: new URL("/perfil", origemCanonica()).toString(),
  });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

/**
 * As mensagens do Auth vêm em inglês e falam de "OTP", "provider" e
 * "credentials" — vocabulário de quem construiu o sistema, não de quem
 * está tentando entrar no app.
 */
function traduzirErroDeEntrada(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha não conferem.";
  }
  if (m.includes("email not confirmed")) {
    return "Falta confirmar seu e-mail: procure a mensagem que enviamos (veja também o lixo eletrônico).";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail. Entre com a senha, ou use \"esqueci a senha\".";
  }
  if (m.includes("phone number already") || m.includes("phone_exists")) {
    return (
      "Este número já está em outra conta. Se for sua, entre por ele em vez do Google — " +
      "assim você volta para os seus cadastros em vez de começar uma conta nova."
    );
  }
  if (m.includes("token has expired") || m.includes("invalid")) {
    return "Código incorreto ou vencido. Peça um novo.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  }
  if (m.includes("sms") || m.includes("provider")) {
    return "O envio do código falhou. Tente de novo em alguns minutos.";
  }
  return mensagem;
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
