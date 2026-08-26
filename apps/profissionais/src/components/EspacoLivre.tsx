import { Link } from "react-router-dom";
import { DIAS_BANNER, precoDoBanner } from "../config";
import { podeVender } from "../lib/plataforma";

/**
 * O convite que ocupa um espaço de publicidade enquanto ninguém comprou.
 *
 * Duas decisões que valem ser ditas:
 *
 * 1. **Só aparece quando o espaço está vazio.** Não é um anúncio a mais
 *    empurrado para quem veio procurar alguém — é o mesmo lugar que já
 *    existia, mostrando que está à venda em vez de sumir. Quando alguém
 *    compra, o convite dá lugar à arte e some sozinho.
 *
 * 2. **Não se disfarça de anúncio real.** Fundo claro, sem imagem e com
 *    a palavra "Espaço de publicidade" escrita: quem passa os olhos
 *    entende que ali não tem nada vendido ainda. Um convite desenhado
 *    para parecer campanha de verdade encheria a tela de anúncio falso —
 *    exatamente o que a etiqueta "Publicidade" existe para evitar.
 */
export function EspacoLivre({ variante }: { variante: "faixa" | "cartao" }) {
  /* Dentro do app da Play Store este convite não existe: ele traz preço e
     leva a um formulário de venda. A venda de banner acontece por conversa,
     fora do app, e é assim que ela continua — o que não pode é o app da
     loja ser a vitrine dela.

     Devolve `null` em vez de um espaço vazio: o lugar dele é um buraco de
     publicidade não vendida, e um buraco reservado sem nada dentro é pior
     que nenhum buraco. */
  if (!podeVender()) return null;

  return (
    <Link
      to="/publicidade"
      className={variante === "faixa" ? "espaco-livre espaco-livre-faixa" : "espaco-livre espaco-livre-cartao"}
    >
      <span className="espaco-livre-etiqueta">Espaço de publicidade</span>
      <strong className="espaco-livre-titulo">Apareça aqui</strong>
      <span className="espaco-livre-texto">
        {variante === "faixa"
          ? "Seu comércio nesta vitrine, para quem abriu o app para ver o que a cidade tem."
          : "Seu comércio na primeira tela do app, para quem é da sua cidade."}
      </span>
      {/* O preço no próprio convite: é a primeira pergunta de quem vê, e
          quem só ia tocar para descobrir quanto custa já sabe daqui. */}
      <span className="espaco-livre-preco">
        {precoDoBanner()} por {DIAS_BANNER} dias
      </span>
      <span className="espaco-livre-botao">Quero anunciar</span>
    </Link>
  );
}
