import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { MapView } from "../components/MapView";
import { NotificationBanner } from "../components/NotificationBanner";
import { PromotedTours } from "../components/PromotedTours";
import { TrendingSection } from "../components/TrendingSection";
import { BannerSlot } from "../components/BannerSlot";
import { categories, categoryColor } from "../lib/categories";
import { useT } from "../i18n";
import type { Category } from "../types";
import { categoryKey } from "../i18n/domain";

export function Home() {
  const { experiences, people, businesses } = useAvena();
  const navigate = useNavigate();
  const t = useT();
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
          <h1>{t("home.emptyTitle")}</h1>
          <p>{t("home.emptyText")}</p>
          <form className="quick-search" onSubmit={handleQuickSearch}>
            <input
              list="known-cities"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder={t("home.searchPlaceholder")}
              aria-label={t("home.searchLabel")}
            />
            <datalist id="known-cities">
              {knownCities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            <button type="submit" className="btn-primary">
              {t("home.search")}
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
          <BannerSlot placement="home-top" />
          <PromotedTours />
          <TrendingSection />

          <div className="empty-cta">
            <h2>{t("home.emptyCtaTitle")}</h2>
            <p className="muted">{t("home.emptyCtaText")}</p>
            <Link to="/experience/new" className="btn-primary">
              {t("home.emptyCtaButton")}
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
            placeholder={t("home.searchPlaceholder")}
            aria-label={t("home.searchLabel")}
          />
          <datalist id="known-cities">
            {knownCities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary">
            {t("home.search")}
          </button>
        </form>
        <MapView experiences={filtered} />
        <Link
          to="/experience/new"
          className="fab"
          title={t("home.newExperience")}
          aria-label={t("home.newExperience")}
        >
          +
        </Link>
      </div>

      <aside className="home-sidebar">
        <NotificationBanner />
        <BannerSlot placement="home-top" />
        <div className="filters">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "Todas")}>
            <option value="Todas">{t("home.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(categoryKey[c])}
              </option>
            ))}
          </select>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="Todas">{t("home.allPeople")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="Todos">{t("home.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <h2 className="timeline-title">{t("home.timeline")}</h2>
        <div className="timeline">
          {sorted.length === 0 && <p className="muted">{t("home.noExperiences")}</p>}
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
