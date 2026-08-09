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

/**
 * A tela de início é vista **uma vez por navegador**, e fica lembrado em
 * `localStorage`.
 *
 * Antes isso era uma variável de módulo, que zera a cada carregamento da
 * página. A intenção era "quem entra no domínio passa pela apresentação",
 * mas o efeito prático era outro: recarregar a busca — F5 no computador,
 * puxar a tela para baixo no celular, ou só voltar ao app depois que o
 * navegador descarregou a aba — jogava a pessoa de volta para a
 * apresentação, perdendo a busca que ela estava fazendo. Apresentação
 * repetida não apresenta nada; só atrapalha quem já é de casa.
 *
 * Quem quiser rever tem o botão no Perfil (`resetOnboarding`).
 */
const INICIO_VISTO = WELCOME_KEY;

export function hasSeenWelcome(): boolean {
  return safeGet(INICIO_VISTO) === "1";
}

export function markWelcomeSeen() {
  safeSet(INICIO_VISTO, "1");
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
