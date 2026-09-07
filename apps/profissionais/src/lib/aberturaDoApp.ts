import { esquecerLadoDaSessao } from "./ladoDaSessao";

/**
 * Toda ABERTURA do app começa na tela de entrar, com a escolha do lado.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "quando fecho o app e entro ele ainda volta na tela do que eu
 * estava. Ele tem que voltar sempre na de login onde tem opção de escolher
 * se é empresa ou pessoa."
 *
 * ── Por que ele voltava para a tela de antes ───────────────────────────
 *
 * Por dois motivos somados, e nenhum deles era um defeito isolado:
 *
 *   1. o navegador (ou o app instalado) reabre no último endereço;
 *   2. o lado escolhido ficava guardado ATÉ SAIR DA CONTA. Quem já tinha
 *      escolhido "procuro emprego" uma vez nunca mais via a pergunta —
 *      a tela de entrar reconhecia o lado guardado e mandava a pessoa
 *      direto para dentro.
 *
 * Ou seja: a tela da escolha existia e estava certa, e mesmo assim era
 * inalcançável na prática. É o mesmo tipo de defeito que já tinha
 * acontecido em 04/09, por outro caminho.
 *
 * ── Como se sabe que o app foi ABERTO, e não só ficou parado ──────────
 *
 * Pelo `sessionStorage`, que é a única coisa do navegador que responde
 * exatamente a essa pergunta: ele vive enquanto a aba (ou o app instalado)
 * está aberta e é apagado quando ela fecha. Minimizar, trocar de app,
 * deixar a tela apagar a noite inteira — nada disso o apaga.
 *
 * É a mesma técnica da `ExigirDesbloqueio`, com marca própria: aquela
 * decide se pede a senha, esta decide para onde levar. Marcas separadas
 * porque quem marca "não pedir senha neste aparelho" desliga aquela, e
 * isso não pode desligar esta.
 *
 * ── ISTO NÃO É UM LOGOUT ───────────────────────────────────────────────
 *
 * A conta continua conectada. O que se apaga é só a escolha do lado, que
 * é a pergunta da porta. Quem toca em "procuro emprego" entra na hora, sem
 * digitar nada — ver o efeito da `LoginPage`.
 *
 * ── O que NÃO é sequestrado ────────────────────────────────────────────
 *
 * Link que alguém mandou. Quem recebe uma vaga no WhatsApp e toca tem de
 * cair NA VAGA — jogar essa pessoa na tela de entrar é perder a única
 * coisa que o botão "Compartilhar" existe para fazer.
 */

const MARCA = "ei-abertura-do-app";

/**
 * Endereços que alguém pode ter mandado para outra pessoa, e as telas da
 * própria entrada. Nenhum deles é desviado.
 *
 * `/` fica de fora da lista porque é onde o app já abre por padrão
 * (`start_url` do manifest) — desviar dali é justamente o que se quer.
 */
const COMPARTILHAVEIS = [
  "/vaga-aberta",
  "/empresa",
  "/profissional",
  "/termos",
  "/privacidade",
  "/como-funciona",
  /* A ajuda entra aqui por um motivo diferente dos outros: não é um link
     que se manda para alguém, é o socorro de quem não consegue entrar. A
     pergunta mais comum do suporte é "não recebi o código" — desviar essa
     pessoa para a tela de entrar seria devolvê-la ao problema. */
  "/ajuda",
  /* Pelo mesmo motivo, e mais um: este é o endereço que fica escrito na
     ficha da Play Store. Quem chega por ele veio de fora, com uma coisa
     só na cabeça. */
  "/excluir-conta",
  /* ── A VOLTA DO MERCADO PAGO — 07/09 ────────────────────────────────
     Estes dois endereços são o que o Mercado Pago abre depois do
     pagamento, e eles vêm DE FORA do app — exatamente como um link que
     alguém mandou.

     Sem esta linha, sair para pagar e voltar parecia uma abertura nova
     (o `sessionStorage` se perde quando o navegador abre a volta noutra
     aba), e o desvio fazia duas coisas ruins de uma vez: pedia a entrada
     de novo E reescrevia o endereço, JOGANDO FORA o `?pedido=`. Com o
     número do pedido perdido, a tela de confirmação não tinha como achar
     o pagamento — quem tinha acabado de pagar via a tela de entrar, e
     depois nada.

     Foi a dona quem topou com isso no primeiro pagamento de verdade:
     "quando sai pro pagamento e volta tá tendo que colocar o login
     novamente". */
  "/pagamento-ok",
  "/pagamento-nao",
  "/login",
  "/onboarding-tipo",
];

function ehCompartilhavel(caminho: string): boolean {
  return COMPARTILHAVEIS.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

function jaMarcado(): boolean {
  try {
    return sessionStorage.getItem(MARCA) === "1";
  } catch {
    /* Armazenamento bloqueado (aba anônima de alguns navegadores): então
       toda navegação pareceria uma abertura nova, e o app viveria
       voltando para a tela de entrar. Melhor não desviar nunca. */
    return true;
  }
}

function marcar(): void {
  try {
    sessionStorage.setItem(MARCA, "1");
  } catch {
    /* segue sem marcar; o `jaMarcado` acima já trata esse caso */
  }
}

/**
 * Decide, uma vez por abertura, se o app deve começar na tela de entrar.
 *
 * Devolve o endereço para onde ir, ou `null` para deixar como está.
 */
export function paraOndeAbrirOApp(caminhoAtual: string): string | null {
  if (jaMarcado()) return null;
  marcar();
  if (ehCompartilhavel(caminhoAtual)) return null;
  /* A conta segue conectada: some só a escolha do lado, para a pergunta
     da porta ser feita de novo. */
  esquecerLadoDaSessao();
  return "/login";
}

/**
 * Aplica a decisão reescrevendo o endereço ANTES do primeiro desenho.
 *
 * Chamada no `main.tsx`, fora do React de propósito. Feita de dentro de um
 * componente ela vira uma corrida com os guardiões de tela — e perde: foi
 * medido, o desvio acontecia e o `SoDesteLado` da tela que estava saindo
 * mandava a pessoa para `/onboarding-tipo` no mesmo quadro. Reescrevendo o
 * endereço antes, o app nasce na tela certa e ninguém corre com ninguém.
 *
 * `replaceState` e não `location.href`: trocar o endereço de verdade
 * recarregaria o app inteiro, e a tela de entrar apareceria depois de um
 * segundo branco.
 */
export function aplicarAberturaDoApp(): void {
  try {
    const destino = paraOndeAbrirOApp(window.location.pathname);
    if (destino) window.history.replaceState(null, "", destino);
  } catch {
    /* Nada aqui justifica impedir o app de abrir. */
  }
}
