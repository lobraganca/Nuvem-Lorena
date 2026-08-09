/**
 * Estrelas com meia estrela.
 *
 * Antes, `"★".repeat(Math.round(media))` desenhava 4 estrelas para 4,2 e
 * também para 4,4 — e 5 para 4,8. Quem escolhe entre dois profissionais
 * escolhe exatamente nessa diferença, e ela estava sendo apagada no
 * arredondamento.
 *
 * A técnica é uma fileira cinza por baixo e a mesma fileira dourada por
 * cima, cortada na largura da nota. Meia estrela sai sem depender de ícone
 * especial, e qualquer fração intermediária também.
 */
export function Estrelas({ nota, tamanho = "1rem" }: { nota: number; tamanho?: string }) {
  const proporcao = Math.max(0, Math.min(1, nota / 5));

  return (
    <span
      className="estrelas"
      style={{ fontSize: tamanho }}
      role="img"
      aria-label={`Nota ${nota.toFixed(1).replace(".", ",")} de 5`}
    >
      <span className="estrelas-fundo" aria-hidden="true">
        ★★★★★
      </span>
      <span className="estrelas-frente" style={{ width: `${proporcao * 100}%` }} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  );
}
