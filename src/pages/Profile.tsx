import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { profileStats } from "../lib/stats";
import { buildCollections } from "../lib/collections";
import { categoryEmoji } from "../lib/categories";

export function Profile() {
  const { experiences, people } = useAvena();
  const stats = profileStats(experiences);
  const collections = buildCollections(experiences);

  const companyCounts = new Map<string, number>();
  for (const exp of experiences) {
    for (const pid of exp.peopleIds) {
      companyCounts.set(pid, (companyCounts.get(pid) ?? 0) + 1);
    }
  }
  const topCompany = [...companyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPerson = topCompany ? people.find((p) => p.id === topCompany[0]) : undefined;

  const places = new Map<
    string,
    { locationName: string; city: string; category: (typeof experiences)[number]["category"]; firstDate: string; visits: number }
  >();
  for (const exp of experiences) {
    const key = `${exp.locationName}|${exp.city}`;
    const existing = places.get(key);
    if (!existing) {
      places.set(key, {
        locationName: exp.locationName,
        city: exp.city,
        category: exp.category,
        firstDate: exp.date,
        visits: 1,
      });
    } else {
      existing.visits += 1;
      if (new Date(exp.date) < new Date(existing.firstDate)) {
        existing.firstDate = exp.date;
      }
    }
  }
  const sortedPlaces = [...places.values()].sort(
    (a, b) => new Date(a.firstDate).getTime() - new Date(b.firstDate).getTime()
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Meu perfil</h1>
      <div className="stats-grid">
        <Stat label="Experiências realizadas" value={stats.total} />
        <Stat label="Cidades visitadas" value={stats.cities} />
        <Stat label="Estados" value={stats.states} />
        <Stat label="Países" value={stats.countries} />
        <Stat label="Trilhas" value={stats.trails} />
        <Stat label="Praias" value={stats.beaches} />
        <Stat label="Cachoeiras" value={stats.waterfalls} />
      </div>

      {topPerson && (
        <div className="insight-card">
          💡 Sua companhia mais frequente é <strong>{topPerson.name}</strong>, com{" "}
          {topCompany![1]} experiências vividas juntos.
        </div>
      )}

      <h2 className="timeline-title">Lugares que já estive</h2>
      <div className="places-grid">
        {sortedPlaces.length === 0 && <p className="muted">Nenhum lugar registrado ainda.</p>}
        {sortedPlaces.map((place) => (
          <div key={`${place.locationName}|${place.city}`} className="place-card">
            <div className="place-emoji">{categoryEmoji[place.category]}</div>
            <div>
              <div className="timeline-card-title">{place.locationName}</div>
              <div className="muted">
                {place.city} · desde {new Date(place.firstDate).toLocaleDateString("pt-BR")}
                {place.visits > 1 ? ` · ${place.visits} visitas` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="timeline-title">Coleções</h2>
      <div className="collections-grid">
        {collections.map((c) => {
          const pct = Math.min(100, Math.round((c.achieved / c.total) * 100));
          return (
            <div key={c.id} className="collection-card">
              <div className="collection-top">
                <span>{c.emoji}</span>
                <span className="muted">
                  {c.achieved}/{c.total}
                </span>
              </div>
              <div className="collection-title">{c.title}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="muted">{pct}% concluído</div>
            </div>
          );
        })}
      </div>

      <h2 className="timeline-title">Pessoas</h2>
      <div className="people-grid">
        {people.map((p) => (
          <Link key={p.id} to={`/person/${p.id}`} className="person-card">
            <div className="avatar" style={{ background: p.avatarColor }}>
              {p.name[0]}
            </div>
            <div>{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
