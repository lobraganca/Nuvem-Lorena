import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { MapView } from "../components/MapView";
import { NotificationBanner } from "../components/NotificationBanner";
import { PromotedTours } from "../components/PromotedTours";
import { TrendingSection } from "../components/TrendingSection";
import { categories, categoryColor } from "../lib/categories";
import type { Category } from "../types";

export function Home() {
  const { experiences, people, businesses } = useAvena();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | "Todas">("Todas");
  const [personId, setPersonId] = useState<string>("Todas");
  const [year, setYear] = useState<string>("Todos");
  const [quickSearch, setQuickSearch] = useState("");

  const knownCities = useMemo(
    () =>
      Array.from(
        new Set([...businesses.map((b) => b.city), ...experiences.map((e) => e.city)])
      ).sort(),
    [businesses, experiences]
  );

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    navigate(`/destination?city=${encodeURIComponent(quickSearch.trim())}`);
  }

  const years = useMemo(
    () =>
      Array.from(
        new Set(experiences.map((e) => new Date(e.date).getFullYear()))
      ).sort((a, b) => b - a),
    [experiences]
  );

  const filtered = experiences.filter((e) => {
    if (category !== "Todas" && e.category !== category) return false;
    if (personId !== "Todas" && !e.peopleIds.includes(personId)) return false;
    if (year !== "Todos" && new Date(e.date).getFullYear() !== Number(year))
      return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // A brand-new traveller has an empty map, and an empty map sells nothing and
  // explains nothing. Until the first memory exists, the home screen is the
  // discovery screen instead.
  if (experiences.length === 0) {
    return (
      <div className="home-empty">
        <section className="home-empty-hero">
          <h1>Comece a colecionar suas viagens</h1>
          <p>
            O Avena guarda no mapa cada lugar que você viveu — com fotos, com
            quem estava junto e com o que valeu a pena — e mostra os passeios,
            guias e restaurantes de quem já foi avaliado pela comunidade.
          </p>
          <form className="quick-search" onSubmit={handleQuickSearch}>
            <input
              list="known-cities"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Para onde você vai? Busque passeios"
              aria-label="Buscar destino"
            />
            <datalist id="known-cities">
              {knownCities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            <button type="submit" className="btn-primary">
              Buscar
            </button>
          </form>
          <div className="chip-row">
            {knownCities.slice(0, 6).map((city) => (
              <button
                key={city}
                type="button"
                className="chip"
                onClick={() => navigate(`/destination?city=${encodeURIComponent(city)}`)}
              >
                {city}
              </button>
            ))}
          </div>
        </section>

        <div className="page page-wide">
          <PromotedTours />
          <TrendingSection />

          <div className="empty-cta">
            <h2>Já viajou antes?</h2>
            <p className="muted">
              Registre uma viagem que você já fez e ela vira o primeiro pin do
              seu mapa afetivo.
            </p>
            <Link to="/experience/new" className="btn-primary">
              Registrar minha primeira memória
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-map">
        <form className="quick-search" onSubmit={handleQuickSearch}>
          <input
            list="known-cities"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Para onde você vai? Busque passeios"
          />
          <datalist id="known-cities">
            {knownCities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary">
            Buscar
          </button>
        </form>
        <MapView experiences={filtered} />
        <Link
          to="/experience/new"
          className="fab"
          title="Nova experiência"
          aria-label="Registrar nova experiência"
        >
          +
        </Link>
      </div>

      <aside className="home-sidebar">
        <NotificationBanner />
        <div className="filters">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "Todas")}>
            <option value="Todas">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="Todas">Todas pessoas</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="Todos">Todos anos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <h2 className="timeline-title">Linha do tempo</h2>
        <div className="timeline">
          {sorted.length === 0 && <p className="muted">Nenhuma experiência encontrada.</p>}
          {sorted.map((exp) => (
            <Link to={`/experience/${exp.id}`} key={exp.id} className="timeline-card">
              <div
                className="category-dot"
                style={{ background: categoryColor[exp.category] }}
                aria-hidden="true"
              />
              <div>
                <div className="timeline-card-title">{exp.title}</div>
                <div className="muted">
                  {exp.locationName} · {new Date(exp.date).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Organic trending only — paid placements stay off the personal map. */}
        <TrendingSection />
      </aside>
    </div>
  );
}
