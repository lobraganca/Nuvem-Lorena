import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BusinessCard } from "../components/BusinessCard";
import { TrendingSection } from "../components/TrendingSection";
import { PromotedTours } from "../components/PromotedTours";
import { buildItinerary, splitIntoDays } from "../lib/itineraries";
import { accessibilityTags } from "../lib/tourAttributes";
import { businessMatches, resolveCity, suggestionsFor } from "../lib/search";
import type { AccessibilityTag, BusinessType } from "../types";

type Tab = "Todos" | BusinessType;

const TABS: Tab[] = ["Todos", "Agência", "Guia", "Hotel", "Restaurante"];

export function Destination() {
  const { businesses, experiences, reviews } = useAvena();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("city") ?? "");
  const [tab, setTab] = useState<Tab>("Todos");
  const [access, setAccess] = useState<AccessibilityTag[]>([]);

  useEffect(() => {
    const city = searchParams.get("city");
    if (city) setQuery(city);
  }, [searchParams]);

  // Suspended businesses are hidden from travelers everywhere.
  const brBusinesses = businesses.filter(
    (b) => b.country === "Brasil" && b.status !== "suspensa"
  );
  const brExperiences = experiences.filter((e) => e.country === "Brasil");

  const cities = useMemo(
    () =>
      Array.from(
        new Set([...brBusinesses.map((b) => b.city), ...brExperiences.map((e) => e.city)])
      ).sort(),
    [brBusinesses, brExperiences]
  );

  // Search matches city, business name or tour title, so someone who heard
  // about a specific guide can find them without knowing the city.
  const term = query.trim();
  const matches = brBusinesses
    .filter((b) => businessMatches(b, term))
    .filter((b) => tab === "Todos" || b.type === tab)
    .filter((b) =>
      access.length === 0
        ? true
        : (b.tours ?? []).some((t) =>
            access.every((a) => (t.accessibility ?? []).includes(a))
          )
    );

  // The roteiro follows the same loose matching as the search, so someone who
  // typed "Arraial" sees the roteiro of Arraial do Cabo instead of nothing.
  const searchedCity = resolveCity(cities, term);
  const suggestions = term && matches.length === 0 ? suggestionsFor(brBusinesses, term) : [];

  const itinerary = searchedCity ? buildItinerary(searchedCity, brExperiences) : null;

  return (
    <div className="viator-hero">
      <div className="viator-hero-inner">
        <h1>Passeios, hotéis e restaurantes pelo Brasil</h1>
        <p className="muted">
          Busque por cidade, nome da agência ou do passeio e reserve com quem já foi avaliado pela comunidade.
        </p>
        <input
          className="destination-search"
          placeholder="Destino, agência ou passeio"
          aria-label="Buscar destino, agência ou passeio"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!query && (
          <div className="chip-row" style={{ marginTop: 14, justifyContent: "center" }}>
            {cities.map((city) => (
              <button key={city} className="chip" onClick={() => setQuery(city)}>
                {city}
              </button>
            ))}
          </div>
        )}
      </div>

      {!query && (
        <div className="page page-wide">
          <PromotedTours />
          <TrendingSection />
        </div>
      )}

      {query && (
        <div className="page page-wide">
          <div className="viator-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`viator-tab ${tab === t ? "viator-tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "Todos" ? "Todos" : `${t}s`}
              </button>
            ))}
          </div>

          <div className="access-filter">
            <span className="muted">Acessibilidade:</span>
            {accessibilityTags.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${access.includes(a) ? "chip-active" : ""}`}
                onClick={() =>
                  setAccess((prev) =>
                    prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                  )
                }
              >
                {a}
              </button>
            ))}
          </div>

          <h2 className="timeline-title">
            {matches.length} {matches.length === 1 ? "resultado" : "resultados"} em {query}
          </h2>

          {matches.length === 0 && (
            <div className="empty-search">
              <p>
                Ainda não temos parceiros cadastrados para <strong>{query}</strong>.
              </p>
              {suggestions.length > 0 && (
                <>
                  <p className="muted">Você quis dizer:</p>
                  <div className="chip-row">
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="chip"
                        onClick={() => setQuery(s.term)}
                      >
                        {s.label} <span className="muted">· {s.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="muted">
                Você também pode buscar pelo estado (por exemplo, RJ ou Minas
                Gerais) ou pela região (Nordeste, Sul).
              </p>
            </div>
          )}

          <div className="viator-grid">
            {matches.map((b) => (
              <BusinessCard key={b.id} business={b} reviews={reviews} />
            ))}
          </div>

          {itinerary && (
            <>
              <h2 className="timeline-title">
                Roteiro de {itinerary.days}{" "}
                {itinerary.days === 1 ? "dia" : "dias"} em {itinerary.city}
              </h2>
              <p className="muted">
                Montado a partir de {itinerary.basedOn} experiências que viajantes
                registraram nesta cidade.
              </p>
              <div className="itinerary">
                {splitIntoDays(itinerary.stops, itinerary.days).map((day, i) => (
                  <div key={i} className="itinerary-day">
                    <div className="itinerary-day-title">Dia {i + 1}</div>
                    {day.map((stop) => (
                      <div key={stop.locationName} className="itinerary-stop">
                        <strong>{stop.locationName}</strong>
                        <span className="muted">
                          {stop.category}
                          {stop.timesVisited > 1
                            ? ` · ${stop.timesVisited} viajantes passaram por aqui`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
