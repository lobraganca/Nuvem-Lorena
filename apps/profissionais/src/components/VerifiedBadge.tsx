/**
 * Selo de verificação: a roseta com tique branco que virou convenção nas
 * redes sociais — a pessoa já sabe o que significa sem precisar ler.
 *
 * Substituiu a etiqueta escrita "✓ Verificado", que ocupava uma linha inteira
 * do card e competia por atenção com o nome. O selo cabe ao lado do nome, que
 * é onde o olho procura por ele.
 *
 * Dourado, e não azul da marca. O dourado é a única cor que ficou reservada
 * à identidade aqui — não existe botão dourado, não existe etiqueta dourada
 * solta —, então quando ele aparece num anúncio a pessoa entende sozinha que
 * aquilo é diferente do resto. E é o único item pago que quem procura
 * enxerga: quem assina precisa ver o dinheiro dele na tela.
 *
 * O tique vai em branco sobre o dourado escuro (5,6:1) em vez do dourado
 * claro: um tique que não se lê transforma o selo numa mancha.
 */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="verified-badge"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Perfil verificado"
    >
      <title>Perfil verificado</title>
      {/* Roseta de 8 pontas: dois quadrados sobrepostos, um girado 45°. */}
      <path
        d="M12 1.5l2.6 2.2 3.4-.3.9 3.3 2.9 1.8-1.4 3.1 1.4 3.1-2.9 1.8-.9 3.3-3.4-.3L12 22.5l-2.6-2.2-3.4.3-.9-3.3-2.9-1.8L3.6 12 2.2 8.9l2.9-1.8.9-3.3 3.4.3z"
        fill="currentColor"
      />
      <path
        d="M7.8 12.2l2.9 2.9 5.5-5.9"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
