import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { MapView } from "../components/MapView";
import { categories, categoryEmoji } from "../lib/categories";
import type { Category } from "../types";

export function Home() {
  const { experiences, people } = useAvena();
  const [category, setCategory] = useState<Category | "Todas">("Todas");
  const [personId, setPersonId] = useState<string>("Todas");
  const [year, setYear] = useState<string>("Todos");

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

  return (
    <div className="home">
      <div className="home-map">
        <MapView experiences={filtered} />
        <Link to="/experience/new" className="fab" title="Nova experiência">
          +
        </Link>
      </div>

      <aside className="home-sidebar">
        <div className="filters">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "Todas")}>
            <option value="Todas">Todas categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryEmoji[c]} {c}
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
              <div className="timeline-emoji">{categoryEmoji[exp.category]}</div>
              <div>
                <div className="timeline-card-title">{exp.title}</div>
                <div className="muted">
                  {exp.locationName} · {new Date(exp.date).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
