import { Link } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";

/**
 * Placeholder da logo "Busca Itabirito", desenhado em SVG inline seguindo a
 * identidade visual definida (lupa dourada com ícone de pessoa em teal sobre
 * fundo navy). Quando o arquivo final da logo existir, basta trocar este
 * componente por um <img>.
 */
export function Logo({ city = DEFAULT_CITY }: { city?: string }) {
  return (
    <Link to="/" className="logo">
      <span className="logo-mark" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F4C542" />
              <stop offset="1" stopColor="#C99A3E" />
            </linearGradient>
          </defs>
          <circle cx="10" cy="10" r="7" stroke="url(#goldGrad)" strokeWidth="2.4" fill="none" />
          <circle cx="10" cy="8.2" r="2" fill="#4FBF9F" />
          <path d="M6.3 13c.9-1.7 2.1-2.5 3.7-2.5s2.8.8 3.7 2.5" stroke="#4FBF9F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <line x1="15" y1="15" x2="20" y2="20" stroke="#C99A3E" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="logo-wordmark">
        <span className="brand">busca</span>
        <span className="city">{city.toUpperCase()}</span>
      </span>
    </Link>
  );
}
