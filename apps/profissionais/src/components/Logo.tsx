import { Link } from "react-router-dom";

/**
 * O circunflexo do "ô" final, desenhado.
 *
 * Precisa ser um desenho, e não o acento da fonte, por dois motivos. O
 * primeiro é a cor: dentro de uma palavra, o acento é parte da letra e não
 * há como pintá-lo de dourado sozinho. O segundo é a forma — o acento da
 * marca é largo e de pontas arredondadas, quase um telhado, e o de qualquer
 * fonte é estreito e pontudo.
 *
 * As medidas são em `em`, então ele acompanha o tamanho do texto sem ajuste.
 */
function Circunflexo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 12" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2.5 9.5 14 2.5 25.5 9.5"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Wordmark "procurô": minúsculas claras e o circunflexo em dourado.
 *
 * O dourado continua sendo a cor reservada à identidade — ele estava no A de
 * BUSCA e agora está no acento. É o mesmo papel: um único ponto de cor que
 * marca a palavra sem transformá-la em enfeite.
 *
 * O `aria-label` traz o nome inteiro porque o acento é um desenho, não uma
 * letra: sem isso um leitor de tela anunciaria "procuro", sem o acento — que
 * é justamente o que muda a palavra de sentido.
 */
function Marca() {
  return (
    <span className="logo-brand" aria-hidden="true">
      procur
      <span className="logo-o">
        o
        <Circunflexo className="logo-acento" />
      </span>
    </span>
  );
}

export function Logo({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  return (
    // Leva para a tela inicial, não para a busca: tocar na marca é o gesto de
    // "voltar ao começo", e é lá que estão as duas portas do app (contratar
    // ou anunciar).
    <Link to="/inicio" className={`logo logo-${size}`} aria-label="procurô — ir para a tela inicial">
      <Marca />
    </Link>
  );
}

/**
 * Mesmo wordmark sem o link, para a tela de início — onde ele é o próprio
 * assunto da tela, não um caminho de volta para a home.
 */
export function LogoMark({
  variant = "default",
}: {
  /** "onBlue" inverte as cores para a marca aparecer sobre o azul da abertura. */
  variant?: "default" | "onBlue";
}) {
  return (
    <div
      className={`logo logo-lg${variant === "onBlue" ? " logo-on-blue" : ""}`}
      role="img"
      aria-label="procurô"
    >
      <Marca />
    </div>
  );
}
