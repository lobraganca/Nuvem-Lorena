/**
 * O símbolo do procurô: o "ô" da marca, sozinho.
 *
 * É o mesmo desenho do ícone do aplicativo (`public/icon-512.png`) — o O
 * branco com o circunflexo dourado —, refeito em SVG para poder ficar
 * dentro do botão da barra sem virar uma imagem borrada em tela retina.
 *
 * As cores saem do próprio ícone, medidas nele: branco puro no O e
 * `#c8a24a` no acento. O dourado dos textos (`--color-gold-mid`, #b8863b)
 * foi escolhido para ser lido sobre branco e some sobre o azul escuro; este
 * é um tom acima, que é o que o ícone já usa há tempos. Marca que muda de
 * cor conforme o lugar deixa de ser marca.
 *
 * O acento é largo e de pontas arredondadas, quase um telhado — igual ao do
 * wordmark em `Logo.tsx`, e diferente do circunflexo de qualquer fonte, que
 * é estreito e pontudo.
 */
export function MarcaProcuro({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 8.6 L12 4.9 L17 8.6"
        stroke="#c8a24a"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="15.2" rx="4.9" ry="5.6" stroke="#fff" strokeWidth="2.3" />
    </svg>
  );
}
