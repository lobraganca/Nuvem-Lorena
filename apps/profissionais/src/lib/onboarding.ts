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

export function hasSeenWelcome(): boolean {
  return safeGet(WELCOME_KEY) === "1";
}

export function markWelcomeSeen() {
  safeSet(WELCOME_KEY, "1");
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
  safeRemove(WELCOME_KEY);
  safeRemove(TOUR_KEY);
  safeRemove(TOUR_PENDING_KEY);
}
