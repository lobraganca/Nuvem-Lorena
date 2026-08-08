/**
 * Estado do primeiro acesso, guardado no próprio navegador.
 *
 * São duas coisas distintas de propósito: a tela de início é vista uma vez
 * (ou quando a pessoa pedir de novo pelo Perfil), e o tour guiado só roda na
 * busca — quem chega dizendo "quero anunciar" vai direto para o painel e não
 * merece um tour sobre uma tela que não é a dele.
 */

const WELCOME_KEY = "busca-itabirito-inicio-visto";
const TOUR_KEY = "busca-itabirito-tour-visto";
/** Marcador de "rode o tour assim que a busca abrir" (some depois de rodar). */
const TOUR_PENDING_KEY = "busca-itabirito-tour-pendente";

/**
 * A tela de início usa `sessionStorage`, não `localStorage`: quem abre o
 * domínio passa por ela **toda vez**, mas navegar dentro do app na mesma
 * visita não joga a pessoa de volta para lá a cada toque em "Buscar".
 *
 * O tour continua no `localStorage` — ele ensina a usar o app, e repetir a
 * cada visita seria estorvo, não ajuda.
 */
function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage bloqueado */
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Navegação anônima com storage bloqueado: trata como "nunca viu", sem
    // quebrar o app.
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage indisponível — segue sem lembrar */
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* idem */
  }
}

/**
 * Marca em memória, não em storage nenhum.
 *
 * `sessionStorage` sobrevive ao recarregar a aba, então quem apertava F5 (ou
 * puxava a tela para baixo no celular) continuava caindo direto na busca — a
 * tela de início só reaparecia ao abrir uma aba nova. Uma variável de módulo
 * zera a cada carregamento da página, que é exatamente o que "toda vez que
 * alguém entrar no domínio" quer dizer, e ao mesmo tempo sobrevive à
 * navegação interna: tocar em "Buscar" não devolve a pessoa para o início.
 */
let jaPassouNestaCarga = false;

export function hasSeenWelcome(): boolean {
  return jaPassouNestaCarga;
}

export function markWelcomeSeen() {
  jaPassouNestaCarga = true;
}

/** Pedido explícito de tour (feito ao escolher "quero contratar"). */
export function requestTour() {
  safeSet(TOUR_PENDING_KEY, "1");
}

export function shouldRunTour(): boolean {
  return safeGet(TOUR_PENDING_KEY) === "1" && safeGet(TOUR_KEY) !== "1";
}

export function markTourSeen() {
  safeSet(TOUR_KEY, "1");
  safeRemove(TOUR_PENDING_KEY);
}

/** Usado pelo Perfil para rever a apresentação do zero. */
export function resetOnboarding() {
  jaPassouNestaCarga = false;
  safeRemove(WELCOME_KEY);
  safeRemove(TOUR_KEY);
  safeRemove(TOUR_PENDING_KEY);
}
