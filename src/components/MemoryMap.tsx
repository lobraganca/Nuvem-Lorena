import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { MapView } from "./MapView";
import { categories, categoryColor } from "../lib/categories";
import { localeFor, useI18n } from "../i18n";
import { categoryKey } from "../i18n/domain";
import type { Category } from "../types";

/**
 * The affective map: everywhere the person has been, with the filters that
 * make it readable, and the list beside it.
 *
 * It lives on the profile rather than on the home screen. A map of your own
 * past is something you go and look at; it is not the thing you need in front
 * of you every time you open the app, and sharing the home screen with the
 * search made both harder to read.
 */
export function MemoryMap() {
  const { experiences, people } = useAvena();
  const { t, lang } = useI18n();

  const [category, setCategory] = useState<Category | "Todas">("Todas");
  const [personId, setPersonId] = useState<string>("Todas");
  const [year, setYear] = useState<string>("Todos");

  const years = useMemo(
    () =>
      Array.from(new Set(experiences.map((e) => new Date(e.date).getFullYear()))).sort(
        (a, b) => b - a
      ),
    [experiences]
  );

  const filtered = experiences.filter((e) => {
    if (category !== "Todas" && e.category !== category) return false;
    if (personId !== "Todas" && !e.peopleIds.includes(personId)) return false;
    if (year !== "Todos" && new Date(e.date).getFullYear() !== Number(year)) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (experiences.length === 0) {
    return (
      <div className="memory-map-empty">
        <p className="muted">{t("map.empty")}</p>
        <Link to="/experience/new" className="btn-primary">
          {t("home.emptyCtaButton")}
        </Link>
      </div>
    );
  }

  return (
    <section className="memory-map">
      <div className="memory-map-head">
        <h2 className="timeline-title">{t("map.title")}</h2>
        <p className="muted">{t("map.subtitle", { count: experiences.length })}</p>
      </div>

      <div className="filters memory-map-filters">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "Todas")}
          aria-label={t("home.allCategories")}
        >
          <option value="Todas">{t("home.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {t(categoryKey[c])}
            </option>
          ))}
        </select>
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          aria-label={t("home.allPeople")}
        >
          <option value="Todas">{t("home.allPeople")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label={t("home.allYears")}
        >
          <option value="Todos">{t("home.allYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="memory-map-canvas">
        <MapView experiences={filtered} />
      </div>

      <h3 className="timeline-title">{t("home.timeline")}</h3>
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
                {exp.locationName} ·{" "}
                {new Date(exp.date).toLocaleDateString(localeFor(lang))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
