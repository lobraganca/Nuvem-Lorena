import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BookTourButton } from "../components/BookTourButton";
import { ReputationBadge } from "../components/ReputationBadge";
import { reviewStatsFor } from "../lib/reviews";

export function Destination() {
  const { businesses, experiences, reviews } = useAvena();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("city") ?? "");

  useEffect(() => {
    const city = searchParams.get("city");
    if (city) setQuery(city);
  }, [searchParams]);

  const brBusinesses = businesses.filter((b) => b.country === "Brasil");
  const brExperiences = experiences.filter((e) => e.country === "Brasil");

  const cities = useMemo(
    () =>
      Array.from(
        new Set([...brBusinesses.map((b) => b.city), ...brExperiences.map((e) => e.city)])
      ).sort(),
    [brBusinesses, brExperiences]
  );

  const matches = brBusinesses.filter((b) =>
    b.city.toLowerCase().includes(query.trim().toLowerCase())
  );

  const agenciesAndGuides = matches.filter((b) => b.type === "Agência" || b.type === "Guia");
  const restaurants = matches.filter((b) => b.type === "Restaurante");
  const hotels = matches.filter((b) => b.type === "Hotel");

  return (
    <div className="page page-wide">
      <h1>Para onde você vai?</h1>
      <p className="muted">
        Busque uma cidade brasileira e veja passeios, guias, agências,
        restaurantes e hotéis recomendados pela comunidade — com a reputação de
        cada um segundo quem já usou.
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
            {agenciesAndGuides.map((b) => {
              const stats = reviewStatsFor(reviews, b.id);
              return (
                <div key={b.id} className="destination-card">
                  <Link to={`/business/${b.id}`} className="business-card-top-link">
                    <div className="business-card-top">
                      <span className="business-type-label">{b.type}</span>
                      <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>
                        {b.planTier}
                      </span>
                    </div>
                    <div className="timeline-card-title">{b.name}</div>
                    <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
                  </Link>
                  {b.tours && b.tours.length > 0 && (
                    <div className="tour-cards">
                      {b.tours.map((t) => (
                        <div key={t.id} className="tour-card">
                          <div>{t.title}</div>
                          <div className="muted">
                            {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                            {t.durationHours !== undefined && ` · ${t.durationHours}h`}
                          </div>
                          <BookTourButton business={b} tour={t} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hotels.length > 0 && (
            <>
              <h2 className="timeline-title">Hotéis em {query}</h2>
              <div className="business-grid">
                {hotels.map((b) => {
                  const stats = reviewStatsFor(reviews, b.id);
                  return (
                    <Link to={`/business/${b.id}`} key={b.id} className="business-card">
                      <div className="business-card-top">
                        <span className="business-type-label">{b.type}</span>
                        <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>
                          {b.planTier}
                        </span>
                      </div>
                      <div className="timeline-card-title">{b.name}</div>
                      <div className="muted">{b.description}</div>
                      <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {restaurants.length > 0 && (
            <>
              <h2 className="timeline-title">Restaurantes em {query}</h2>
              <div className="business-grid">
                {restaurants.map((b) => {
                  const stats = reviewStatsFor(reviews, b.id);
                  return (
                    <Link to={`/business/${b.id}`} key={b.id} className="business-card">
                      <div className="business-card-top">
                        <span className="business-type-label">{b.type}</span>
                        <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>
                          {b.planTier}
                        </span>
                      </div>
                      <div className="timeline-card-title">{b.name}</div>
                      <div className="muted">{b.description}</div>
                      <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
