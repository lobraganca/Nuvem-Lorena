/**
 * O foguinho da área de destaque.
 *
 * A dona: "pensei de uma sessão que tenha um ícone de foguinho e as
 * pessoas que pagam para estar ali, enfileiradas verticalmente."
 *
 * Desenhado, e não emoji 🔥 — pelo mesmo motivo dos outros ícones do app
 * (ver `IconesInicio`): o mesmo código vira um desenho diferente em cada
 * aparelho, e ao lado de ícones de traço ele denuncia que as duas coisas
 * foram feitas em momentos diferentes.
 *
 * Preenchido, e não de traço: ele não é um botão nem um estado — é um
 * carimbo de "aqui é quente", e no tamanho de um título uma chama vazada
 * some.
 */
export function IconeFogo({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* ── O FOGUINHO FICOU CHEIO E CENTRADO — 06/09 ──────────────────
          A dona: "o foguinho do app pode ser melhor. Mais chamativo."

          O antigo era uma chama fina e TORTA: o desenho pendia para a
          direita e a labareda de trás vinha com 55% de opacidade. Em 13px
          — que é o tamanho dele dentro do selo "Em alta" — sobrava um
          borrão sem forma, e a coisa mais cara do app (o destaque que a
          pessoa paga) era anunciada por uma mancha.

          O novo é simétrico, ocupa a caixa toda e tem a chama interna
          RECORTADA em vez de translúcida — buraco no desenho continua
          nítido em qualquer tamanho, opacidade não. `evenodd` é o que faz
          o recorte: o miolo é um segundo contorno dentro do primeiro. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5c.6 2.1.2 3.8-.9 5.2-.5.7-1.1 1.3-1.7 1.9-1 1-2 2-2.7 3.2-.8 1.3-1.2 2.8-1.2 4.5 0 3.7 3 6.7 6.5 6.7s6.5-3 6.5-6.7c0-2-.6-3.7-1.5-5.2-.7-1.2-1.6-2.3-2.4-3.3-1.1-1.4-2.1-2.7-2.6-4.2-.1-.3-.1-.6 0-.9Zm0 17.9c-1.7 0-3.1-1.4-3.1-3.2 0-1.1.5-1.9 1.1-2.7.4-.5.8-1 1.1-1.6.2-.4.3-.8.3-1.2.7.9 1.3 1.6 1.9 2.4.7 1 1.1 1.9 1.1 3.1 0 1.8-1.4 3.2-3.1 3.2Z"
      />
    </svg>
  );
}
