import marcaEi from "/marca-ei.png";

/**
 * O símbolo do Ei Itabirito, para caber dentro do botão redondo da barra.
 *
 * Era o "ô" do procurô, desenhado em SVG. Com a marca nova o desenho mudou
 * de natureza: o "Ei" é uma letra fechada com curvas próprias, e refazê-la
 * em `path` produziria uma imitação parecida — pior que nenhuma, porque
 * ninguém percebe que está errada até ver as duas lado a lado.
 *
 * O arquivo é o mesmo da abertura e do cabeçalho, com fundo transparente:
 * uma marca só, num lugar só. Duas cópias de um logotipo divergem no dia em
 * que alguém ajusta uma delas.
 *
 * O nome do arquivo continua `MarcaProcuro` porque ele é importado em vários
 * lugares e renomear tudo agora misturaria a troca da marca com uma
 * arrumação de nomes — duas coisas que é melhor conferir separadas.
 */
export function MarcaProcuro({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <img
      src={marcaEi}
      width={tamanho}
      height={tamanho}
      alt=""
      aria-hidden="true"
      /* `contain` porque a marca é mais larga que alta: dentro de uma caixa
         quadrada, sem isto ela seria esticada e o "E" engordaria. */
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
