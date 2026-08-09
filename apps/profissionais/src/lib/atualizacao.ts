/**
 * Manter o app instalado sempre na versão publicada.
 *
 * O app instalado na tela do celular não recarrega como uma aba do
 * navegador: ele fica aberto em segundo plano por dias, e quando a pessoa
 * volta é a mesma página de antes que reaparece. No iPhone não há nem o
 * gesto de arrastar para baixo para recarregar — a barra do Safari não
 * existe ali. Sem isso, "já publiquei" e "ainda não publiquei" são a mesma
 * coisa do lado de quem usa.
 *
 * São duas peças:
 *
 * 1. Toda vez que o app volta a aparecer na tela, pergunta ao navegador se
 *    existe versão nova. É o único gancho confiável no iPhone.
 * 2. Quando a versão nova assume o controle, recarrega uma vez — a `flag`
 *    evita o laço de recarregar sem parar que acontece se dois avisos
 *    chegarem juntos.
 */
export function cuidarDasAtualizacoes() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  async function procurarVersaoNova() {
    if (document.visibilityState !== "visible") return;
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      await registro?.update();
    } catch {
      /* sem rede, ou navegador sem suporte: tenta de novo na próxima vez */
    }
  }

  document.addEventListener("visibilitychange", procurarVersaoNova);
  window.addEventListener("focus", procurarVersaoNova);
  void procurarVersaoNova();
}
