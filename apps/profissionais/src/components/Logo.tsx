import { Link } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";

/**
 * O "A" final de BUSCA, desenhado como duas hastes que se encontram no ápice,
 * sem travessão — é o detalhe que dá identidade ao wordmark, e nenhuma fonte
 * comum entrega isso. Escala junto com o texto porque as medidas são em `em`.
 */
function ApexA({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 22 26" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M1.7 25 11 1.7 20.3 25"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Wordmark "BUSCA ITABIRITO": letras claras e espaçadas, o A final em
 * dourado e a cidade abaixo, também em dourado, com bastante entreletra.
 *
 * O `aria-label` no link carrega o nome inteiro porque o A é um desenho, não
 * uma letra — sem isso um leitor de tela anunciaria "BUSC".
 */
export function Logo({ city = DEFAULT_CITY, size = "sm" }: { city?: string; size?: "sm" | "lg" }) {
  return (
    <Link to="/" className={`logo logo-${size}`} aria-label={`Busca ${city}`}>
      <span className="logo-brand" aria-hidden="true">
        <span className="logo-letters">BUSC</span>
        <ApexA className="logo-apex" />
      </span>
      <span className="logo-city" aria-hidden="true">
        {city.toUpperCase()}
      </span>
    </Link>
  );
}

/**
 * Mesmo wordmark sem o link, para a tela de início — onde ele é o próprio
 * assunto da tela, não um caminho de volta para a home.
 */
export function LogoMark({ city = DEFAULT_CITY }: { city?: string }) {
  return (
    <div className="logo logo-lg" role="img" aria-label={`Busca ${city}`}>
      <span className="logo-brand" aria-hidden="true">
        <span className="logo-letters">BUSC</span>
        <ApexA className="logo-apex" />
      </span>
      <span className="logo-city" aria-hidden="true">
        {city.toUpperCase()}
      </span>
    </div>
  );
}
