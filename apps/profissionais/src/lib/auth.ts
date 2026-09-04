import { supabase } from "./supabase";
import { esquecerLadoDaSessao } from "./ladoDaSessao";
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
  /* Depois de "Sair", o Google precisa perguntar QUAL conta.
     Sem este pedido, ele reaproveita em silêncio a conta que já está
     aberta no aparelho: a pessoa toca em sair, toca em entrar, e volta
     exatamente para a mesma conta — sem tela nenhuma no meio e sem
     nenhuma forma de trocar. Quem tem duas contas (a pessoal e a do
     negócio), ou empresta o celular, fica preso na primeira.
     Só depois de sair, e não sempre: para quem tem uma conta só, a tela
     de escolha em todo login é um toque a mais sem serventia. */
  const escolherConta = pediuParaTrocarDeConta();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: destino,
      ...(escolherConta ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error) throw error;
}

/**
 * Marca que o próximo login deve perguntar qual conta.
 *
 * Guardado no aparelho porque a volta do Google recarrega a página: nada
 * que viva só na memória sobrevive à ida e à volta do login.
 */
const CHAVE_TROCAR_DE_CONTA = "ei-escolher-conta";

function pediuParaTrocarDeConta(): boolean {
  try {
    const pediu = window.localStorage.getItem(CHAVE_TROCAR_DE_CONTA) === "1";
    /* Lido e apagado no mesmo movimento: o pedido vale para o login
       seguinte, não para sempre. */
    if (pediu) window.localStorage.removeItem(CHAVE_TROCAR_DE_CONTA);
    return pediu;
  } catch {
    return false;
  }
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
export async function entrarComTelefone(
  telefone: string,
): Promise<{ jaTinhaConta: boolean }> {
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

  /* ── "ESSE NÚMERO JÁ TEM CONTA" ──────────────────────────────────────
     A dona: "quando a pessoa já tem o telefone cadastrado, ao inserir o
     número novamente pra receber o código deve aparecer uma mensagem
     falando que já tem conta pra entrar."

     O Supabase não responde "este telefone existe?" — e não responde de
     propósito, para ninguém ficar testando números alheios. Mas ele
     responde a uma pergunta vizinha, que serve: `shouldCreateUser: false`
     manda o código APENAS se a conta já existir, e recusa se não existir.

     Então são duas tentativas, nesta ordem:

       1ª  "manda só se já existir" — se passar, a conta existe, o código
           já foi enviado, e a tela avisa que o caso é entrar, não criar.
           Ninguém recebe dois SMS.
       2ª  só acontece quando a primeira recusou: aí a conta é nova mesmo,
           e o código sai criando o cadastro.

     Se a segunda também falhar, o erro que sobe é o dela — o da primeira
     seria "usuário não existe", que aqui não é erro, é a resposta. */
  const { error: erroSeExiste } = await client.auth.signInWithOtp({
    phone: `+55${digitos}`,
    options: { shouldCreateUser: false },
  });
  if (!erroSeExiste) return { jaTinhaConta: true };

  const { error } = await client.auth.signInWithOtp({ phone: `+55${digitos}` });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
  return { jaTinhaConta: false };
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

  /* Antes de acreditar no erro, pergunta se a pessoa entrou.
     ─────────────────────────────────────────────────────────
     Isto não é paranoia: o log do Supabase mostrou o padrão. Numa mesma
     tentativa aparecem `/otp`, depois `/verify`, um evento de login — e
     UM SEGUNDO `/verify` dois segundos depois, com aviso. O primeiro
     gastou o código e criou a sessão; o segundo chega num código que já
     não vale e devolve "token inválido".

     Onde nasce o segundo não está esclarecido, e é honesto dizer isso: o
     app tem um único lugar que confere código, com o botão desabilitado
     enquanto a conferência corre. Pode ser um toque duplo que escapa
     entre o clique e o `setEnviando`, pode ser algo do lado do provedor.

     O que ESTÁ esclarecido é o efeito, e ele é o pior possível: a pessoa
     entrou de verdade e a tela diz "código incorreto". Ela pede outro
     código — que também vai parecer falhar — e desiste achando que o app
     não funciona, já logada.

     Um erro só é erro se a pessoa continuou de fora. Se existe sessão, o
     login aconteceu, e a mensagem seria mentira. */
  if (error) {
    const { data } = await client.auth.getSession();
    if (data.session?.user) return;
    throw new Error(traduzirErroDeEntrada(error.message));
  }
}

/**
 * Entrar com o celular e uma senha — sem gastar SMS.
 *
 * ── POR QUE ISTO EXISTE ────────────────────────────────────────────────
 *
 * A dona: "acho que podemos inserir a pessoa cadastrar uma conta depois
 * que confirma o número de telefone, assim ele não precisa ficar gastando
 * sms toda vez que entrar."
 *
 * São duas economias, e a segunda é maior que a primeira. A óbvia é o
 * custo: cada entrada custava uma mensagem no Twilio, para sempre. A
 * outra é a pessoa: esperar o SMS, sair do app para ler, voltar e digitar
 * seis dígitos é meio minuto e três chances de desistir — toda vez.
 *
 * O telefone continua sendo a identidade da conta. A senha é só um
 * segundo jeito de provar que ela é dela; quem esquecer a senha volta
 * pelo SMS, que nunca deixa de funcionar.
 */
export async function entrarComTelefoneESenha(telefone: string, senha: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const digitos = onlyPhoneDigits(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error("Confira o número: precisa ter DDD e 8 ou 9 dígitos.");
  }

  const { error } = await client.auth.signInWithPassword({
    phone: `+55${digitos}`,
    password: senha,
  });
  if (error) throw new Error(traduzirErroDeEntrada(error.message));
}

/**
 * Guarda uma senha na conta que já está aberta.
 *
 * Só funciona logada, e é de propósito: quem chega aqui acabou de provar o
 * número por SMS. Definir senha sem essa prova seria deixar qualquer um
 * escolher a senha de um telefone alheio.
 *
 * O `data.tem_senha` é o que a tela lê depois para saber se ainda precisa
 * oferecer. O Supabase não conta se a conta tem senha — perguntar
 * "tem senha?" não existe na API —, e sem esta marca o app ofereceria
 * criar senha para sempre, inclusive para quem já criou.
 */
export async function definirSenha(senha: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (senha.length < 8) throw new Error("A senha precisa de pelo menos 8 caracteres.");

  const { error } = await client.auth.updateUser({
    password: senha,
    data: { tem_senha: true },
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
  /* Sair daqui não desconecta o Google do aparelho — e não deve mesmo:
     ninguém espera que sair do procurô derrube o Gmail. O que se pode
     fazer é garantir que a próxima entrada pergunte qual conta, senão
     "sair" não leva a lugar nenhum: o botão de entrar devolve a mesma
     conta no mesmo instante. */
  try {
    window.localStorage.setItem(CHAVE_TROCAR_DE_CONTA, "1");
  } catch {
    /* Sem armazenamento, o login segue como antes. */
  }
  /* ── SAIR É O CAMINHO DE TROCAR DE LADO — 04/09 ────────────────────
     A dona: "na tela de login a pessoa vai ter que escolher entre quero
     contratar ou procuro emprego... uma pessoa que entra só pra procurar
     um emprego, só terá as opções para isso."

     Com o lado escolhido na porta e fixo por dentro, sair e entrar de
     novo passou a ser a ÚNICA forma de ir para o outro lado. Se a
     escolha sobrevivesse ao logout, quem saísse para trocar entraria de
     volta no mesmo lugar — e não teria mais caminho nenhum. */
  esquecerLadoDaSessao();
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
