/**
 * Opening the app as if for the first time.
 *
 * Everything the app knows lives in this browser, so the second visit is never
 * the first one again — which makes it impossible to walk through the entrance,
 * the account and the onboarding while testing. This clears that, and only when
 * the address says so out loud.
 *
 * It runs before React so no screen ever reads the old data, and it is
 * destructive by design: on a real phone with real memories it would erase
 * them, which is why it is a deliberate address and not a button. It also
 * strips itself out of the URL, so a reload does not wipe the fresh start.
 */
import { readStored, removeStored } from "./safeStorage";

/** Every key the app writes. Kept together so nothing survives by omission. */
const ALL_KEYS = [
  "avena-data-v19",
  "avena-account",
  "avena-session",
  "avena-phone-pending",
  "avena-cookie-consent",
  "avena-app-offer-dismissed",
  "avena-lang",
];

const FLAG = "recomecar";

export function startOverIfAsked() {
  if (typeof window === "undefined") return;

  // Works with either router: BrowserRouter keeps the query in the search,
  // HashRouter pushes it after the '#'.
  const inSearch = new URLSearchParams(window.location.search).get(FLAG);
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const inHash = new URLSearchParams(hashQuery).get(FLAG);
  if (inSearch !== "1" && inHash !== "1") return;

  /*
   * Confirmar antes de apagar.
   *
   * Isto existia para eu poder testar do zero, e virou uma arma: bastava
   * mandar "olha o Avena: <endereço>/?recomecar=1" para alguém, e abrir o
   * link apagava as memórias, as reservas e a conta dessa pessoa — sem aviso,
   * sem pergunta, sem desfazer. Um link que destrói dados ao ser aberto é a
   * definição de armadilha, e não importa que a intenção fosse boa.
   *
   * A pergunta só aparece quando há o que perder. Num aparelho vazio ela
   * seria só um obstáculo entre a pessoa e o app.
   */
  const temDados = ALL_KEYS.some((k) => {
    const valor = readStored(k);
    return Boolean(valor) && valor !== "{}" && valor !== "[]";
  });

  if (temDados) {
    const certeza = window.confirm(
      "Este link apaga TUDO o que está guardado neste aparelho: conta, " +
        "memórias, reservas e listas. Não há como desfazer nem recuperar.\n\n" +
        "Se você não pediu isso, toque em Cancelar — nada será apagado."
    );
    if (!certeza) {
      // O endereço é limpo do mesmo jeito, para um F5 não repetir a pergunta.
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
  }

  for (const key of ALL_KEYS) removeStored(key);
  try {
    // Anything else this app wrote, including keys added later.
    //
    // O prefixo "sb-" entrou junto quando as contas passaram a viver no
    // servidor: a sessão do Supabase se guarda sob esse nome, não sob
    // "avena", e sem apagá-la o "recomeçar" limpava tudo e o app entrava
    // sozinho de novo, com a mesma conta. Quem queria rever a tela de entrada
    // via o app aberto — exatamente o que o endereço promete evitar.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("avena") || key.startsWith("sb-")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage is unavailable; the removeStored calls above already covered
    // the in-memory copy, which is all there is in that case.
  }

  // The stored copy of the app goes too. Without this, "start over" cleared
  // the data but the phone kept answering with the build it had saved, so the
  // screens were still the old ones — which looks exactly like a fix that
  // never arrived.
  void discardInstalledCopy();

  window.history.replaceState({}, "", window.location.pathname);
}

async function discardInstalledCopy() {
  try {
    if ("serviceWorker" in navigator) {
      const workers = await navigator.serviceWorker.getRegistrations();
      await Promise.all(workers.map((w) => w.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // Nothing to undo: at worst the phone keeps the copy it had, which is the
    // behaviour before this existed.
  }
}
