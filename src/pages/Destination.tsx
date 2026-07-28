import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

const typeEmoji: Record<string, string> = {
  Agência: "🧭",
  Guia: "🥾",
  Restaurante: "🍽️",
};

export function Destination() {
  const { businesses, experiences } = useAvena();
  const [query, setQuery] = useState("");

  const cities = useMemo(
    () =>
      Array.from(
        new Set([...businesses.map((b) => b.city), ...experiences.map((e) => e.city)])
      ).sort(),
    [businesses, experiences]
  );

  const matches = businesses.filter((b) =>
    b.city.toLowerCase().includes(query.trim().toLowerCase())
  );

  const agenciesAndGuides = matches.filter((b) => b.type !== "Restaurante");
  const restaurants = matches.filter((b) => b.type === "Restaurante");

  return (
    <div className="page page-wide">
      <h1>Para onde você vai?</h1>
      <p className="muted">
        Busque um destino e veja passeios, guias, agências e restaurantes
        recomendados pela comunidade.
      </p>

      <input
        className="destination-search"
        placeholder="Buscar cidade (ex: Arraial do Cabo)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!query && (
        <div className="chip-row" style={{ marginTop: 12 }}>
          {cities.map((city) => (
            <button key={city} className="chip" onClick={() => setQuery(city)}>
              {city}
            </button>
          ))}
        </div>
      )}

      {query && (
        <>
          <h2 className="timeline-title">
            Passeios, agências e guias em {query} ({agenciesAndGuides.length})
          </h2>
          <div className="business-grid">
            {agenciesAndGuides.length === 0 && (
              <p className="muted">Nenhum resultado encontrado ainda para esse destino.</p>
            )}
            {agenciesAndGuides.map((b) => (
              <div key={b.id} className="destination-card">
                <Link to={`/business/${b.id}`} className="business-card-top-link">
                  <div className="business-card-top">
                    <span>{typeEmoji[b.type]}</span>
                    <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>
                      {b.planTier}
                    </span>
                  </div>
                  <div className="timeline-card-title">{b.name}</div>
                  <div className="muted">{b.type}</div>
                </Link>
                {b.tours && b.tours.length > 0 && (
                  <ul className="tour-list">
                    {b.tours.map((t) => (
                      <li key={t.id}>
                        {t.title}
                        {t.priceFrom !== undefined && ` · a partir de R$ ${t.priceFrom}`}
                        {t.durationHours !== undefined && ` · ${t.durationHours}h`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {restaurants.length > 0 && (
            <>
              <h2 className="timeline-title">Restaurantes em {query}</h2>
              <div className="business-grid">
                {restaurants.map((b) => (
                  <Link to={`/business/${b.id}`} key={b.id} className="business-card">
                    <div className="business-card-top">
                      <span>🍽️</span>
                      <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>
                        {b.planTier}
                      </span>
                    </div>
                    <div className="timeline-card-title">{b.name}</div>
                    <div className="muted">{b.description}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
