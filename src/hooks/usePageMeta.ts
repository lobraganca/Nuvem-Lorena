import { useEffect } from "react";

/**
 * Título e descrição da página aberta.
 *
 * Num app de uma página só, o navegador nunca troca o `<title>` sozinho: todas
 * as telas herdavam o mesmo, e a consequência aparece exatamente onde dói.
 * Quem compartilha um passeio no WhatsApp manda "Avena — passeios, guias e o
 * seu mapa de viagens pelo Brasil" em vez do nome do passeio; quem tem seis
 * abas abertas não distingue nenhuma; e o Google, quando houver servidor para
 * indexar, vê o site inteiro com um título só.
 *
 * O que este arquivo faz é o possível sem servidor. O que ele **não** faz, e
 * nenhum código no navegador faz, é aparecer na prévia do WhatsApp ou do
 * Facebook: esses robôs leem o HTML cru e vão embora antes de qualquer
 * JavaScript rodar. Prévia por link exige o servidor devolvendo a página já
 * com as marcas — está anotado em docs/pendencias-para-o-ar.md.
 */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    if (!title) return;
    const anterior = document.title;
    document.title = `${title} · Avena`;

    const tag = document.querySelector('meta[name="description"]');
    const descAnterior = tag?.getAttribute("content") ?? null;
    if (description && tag) tag.setAttribute("content", description);

    return () => {
      document.title = anterior;
      if (descAnterior !== null && tag) tag.setAttribute("content", descAnterior);
    };
  }, [title, description]);
}
