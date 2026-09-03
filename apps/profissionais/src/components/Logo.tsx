import { Link } from "react-router-dom";
import marcaEi from "/marca-ei.png";

/**
 * O símbolo do Ei Emprego: o "Ei" desenhado, com a bolinha e a virgula
 * laranja.
 *
 * É imagem, e não SVG desenhado à mão, de propósito: o traço da marca é uma
 * letra fechada com curvas próprias, e redesenhá-la em `path` seria produzir
 * uma imitação parecida — que é pior que nenhuma, porque ninguém percebe que
 * está errada até ver as duas lado a lado.
 *
 * O arquivo saiu da arte original com o fundo azul removido pixel a pixel
 * (0,04% dos pixels destoam, todos na costura entre o branco e o laranja —
 * invisível em qualquer tamanho de tela). Fundo transparente é o que permite
 * usar a mesma marca sobre o azul da abertura e sobre o branco do cabeçalho,
 * sem manter dois arquivos que um dia divergem.
 */
function Marca({ className }: { className?: string }) {
  return <img src={marcaEi} alt="" className={className} aria-hidden="true" />;
}

export function Logo({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  return (
    // Leva para a tela inicial, não para a busca: tocar na marca é o gesto de
    // "voltar ao começo", e é lá que estão as duas portas do app (contratar
    // ou anunciar).
    <Link to="/inicio" className={`logo logo-${size}`} aria-label="Ei Emprego — ir para a tela inicial">
      <Marca className="logo-marca" />
      <span className="logo-brand" aria-hidden="true">
        Ei Emprego
      </span>
    </Link>
  );
}

/**
 * Só o símbolo, grande, para a abertura do app.
 *
 * Sem o nome escrito ao lado: na abertura a marca aparece por menos de um
 * segundo, e nesse tempo ninguém lê — só reconhece. Texto ali seria uma
 * palavra que pisca e some, que é o tipo de coisa que faz a pessoa achar
 * que perdeu alguma informação.
 */
export function LogoMark({
  variant = "default",
}: {
  /** "onBlue" é a abertura: fundo azul, marca centralizada. */
  variant?: "default" | "onBlue";
}) {
  return (
    <div
      className={`logo logo-lg${variant === "onBlue" ? " logo-on-blue" : ""}`}
      role="img"
      aria-label="Ei Emprego"
    >
      <Marca className="logo-marca" />
    </div>
  );
}
