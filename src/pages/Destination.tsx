import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BusinessCard } from "../components/BusinessCard";
import { TrendingSection } from "../components/TrendingSection";
import { PromotedTours } from "../components/PromotedTours";
import type { BusinessType } from "../types";

type Tab = "Todos" | BusinessType;

const TABS: Tab[] = ["Todos", "Agência", "Guia", "Hotel", "Restaurante"];

export function Destination() {
  const { businesses, experiences, reviews } = useAvena();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("city") ?? "");
  const [tab, setTab] = useState<Tab>("Todos");

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

  const matches = brBusinesses
    .filter((b) => b.city.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((b) => tab === "Todos" || b.type === tab);

  return (
    <div className="viator-hero">
      <div className="viator-hero-inner">
        <h1>Passeios, hotéis e restaurantes pelo Brasil</h1>
        <p className="muted">
          Busque um destino e reserve com quem já foi avaliado pela comunidade.
        </p>
        <input
          className="destination-search"
          placeholder="Para onde você vai? (ex: Arraial do Cabo)"
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

          <h2 className="timeline-title">
            {matches.length} {matches.length === 1 ? "resultado" : "resultados"} em {query}
          </h2>

          <div className="viator-grid">
            {matches.length === 0 && (
              <p className="muted">Nenhum resultado encontrado ainda para esse destino.</p>
            )}
            {matches.map((b) => (
              <BusinessCard key={b.id} business={b} reviews={reviews} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
