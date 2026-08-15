/**
 * Selo da conta premium: a roseta que virou convenção nas redes sociais.
 *
 * Chamava-se "verificado" e mudou de nome por honestidade. O selo era
 * liberado pelo pagamento, automaticamente — ninguém conferia documento
 * nenhum. Uma etiqueta escrita "verificado" num cadastro é entendida como
 * "esta plataforma checou quem é essa pessoa", e é isso que um cliente
 * lesado levaria a um juiz: a plataforma afirmou uma checagem que não fez.
 *
 * "Premium" não promete nada que não seja verdade — diz que a pessoa assina
 * um plano, e é exatamente isso que aconteceu. O nome da coluna no banco
 * continua `verified` porque trocá-lo mexeria em oito arquivos e em nada que
 * alguém veja.
 *
 * Dourado, e não azul da marca. O dourado é a única cor que ficou reservada
 * à identidade aqui — não existe botão dourado, não existe etiqueta dourada
 * solta —, então quando ele aparece num cadastro a pessoa entende sozinha que
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
      aria-label="Conta premium"
    >
      <title>Conta premium</title>
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
