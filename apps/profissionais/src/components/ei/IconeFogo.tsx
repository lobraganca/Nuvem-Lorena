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
      <path d="M13.4 2.2c.3 2.6-.6 4.3-2 5.7-1.6 1.6-3.6 3-3.6 6.1 0 3.3 2.7 6 6.1 6s6.1-2.7 6.1-6c0-4.2-2.6-6.6-4.2-8.7-.6-.8-1.5-1.9-2.4-3.1Z" />
      <path d="M8.6 12.9c-1.5 1-2.4 2.4-2.4 4.1 0 1.4.6 2.7 1.6 3.6-1.9-.9-3.2-2.8-3.2-5 0-1.4.5-2.4 1.3-3.3.6-.6 1.5-1.2 2.7-1.9-.1.9 0 1.7 0 2.5Z" opacity=".55" />
    </svg>
  );
}
