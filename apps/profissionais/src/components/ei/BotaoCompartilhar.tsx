import { useState } from "react";
import { ehAppDaLoja } from "../../lib/plataforma";

/**
 * "Manda essa vaga pra fulano."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "ter ícone para compartilhar a vaga com uma pessoa."
 *
 * ── Por que isso vale mais aqui do que num app grande ──────────────────
 *
 * Numa cidade pequena, vaga não circula por anúncio: circula por WhatsApp,
 * de uma pessoa que viu para outra que precisa. Isso já acontecia — só que
 * a pessoa mandava um print, e o print não tem link: quem recebia lia a
 * vaga e não tinha como responder a ela.
 *
 * ── Três caminhos, nesta ordem ─────────────────────────────────────────
 *
 * 1. `navigator.share` — a folha de compartilhar do próprio celular, com
 *    WhatsApp, Telegram, SMS e o resto. É o que quase todo mundo aqui vai
 *    ver, porque é o caminho de todo Android e iPhone atual.
 * 2. Copiar o link, quando o navegador não tem a folha (é o caso de quase
 *    todo desktop).
 * 3. Um `prompt` com o texto pronto, se nem a área de transferência
 *    existir — feio, mas ainda deixa a pessoa copiar à mão.
 *
 * O erro de `navigator.share` é engolido de propósito: fechar a folha sem
 * escolher nada é um `AbortError`, e mostrar "não deu para compartilhar"
 * para quem simplesmente desistiu seria acusar a pessoa de um defeito que
 * não houve.
 *
 * ── O endereço é sempre o do site ──────────────────────────────────────
 *
 * Dentro do app instalado, `window.location.origin` é um endereço interno
 * do aparelho (`http://localhost`). Compartilhar isso manda um link que só
 * abre no celular de quem mandou — o defeito não apareceria em teste
 * nenhum, porque no navegador o endereço está certo.
 */

/** O site, sempre — nunca o endereço interno do app instalado. */
const SITE = "https://www.empregoitabirito.com.br";

export function BotaoCompartilhar({
  titulo,
  texto,
  caminho,
  rotulo = "Compartilhar",
}: {
  /** O que aparece como título na folha de compartilhar. */
  titulo: string;
  /** A frase que vai junto do link. */
  texto: string;
  /** O caminho no app, começando com barra. Ex.: `/vaga-aberta/123`. */
  caminho: string;
  rotulo?: string;
}) {
  const [aviso, setAviso] = useState("");

  const endereco = `${ehAppDaLoja() ? SITE : origemDoSite()}${caminho}`;

  async function compartilhar() {
    const dados = { title: titulo, text: texto, url: endereco };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(dados);
        return;
      } catch {
        /* Desistiu de compartilhar, ou o aparelho recusou. Segue para o
           caminho de copiar, que resolve os dois casos. */
      }
    }

    const paraCopiar = `${texto}\n${endereco}`;
    try {
      await navigator.clipboard.writeText(paraCopiar);
      setAviso("Link copiado. É só colar na conversa.");
      setTimeout(() => setAviso(""), 4000);
      return;
    } catch {
      /* Sem área de transferência (acontece em navegador antigo e em
         página aberta sem HTTPS). */
    }

    window.prompt("Copie o link da vaga:", paraCopiar);
  }

  return (
    <>
      {/* Sem rótulo escrito (é o caso da barra de topo, onde não cabe
          texto), o nome vai no `aria-label` — senão o leitor de tela
          anuncia um botão sem nome nenhum. */}
      <button
        type="button"
        className="ei-compartilhar"
        onClick={compartilhar}
        aria-label={rotulo || "Compartilhar"}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" />
        </svg>
        {rotulo && <span>{rotulo}</span>}
      </button>
      {aviso && (
        <p className="ei-apoio" role="status" style={{ marginTop: 6 }}>
          {aviso}
        </p>
      )}
    </>
  );
}

/* No navegador, o endereço de onde o app está aberto — para o link
   compartilhado continuar funcionando em ambiente de teste. */
function origemDoSite(): string {
  if (typeof window === "undefined") return SITE;
  return window.location.origin;
}
