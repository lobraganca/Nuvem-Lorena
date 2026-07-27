import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { profileStats } from "../lib/stats";

export function Profile() {
  const { experiences, people } = useAvena();
  const stats = profileStats(experiences);

  const companyCounts = new Map<string, number>();
  for (const exp of experiences) {
    for (const pid of exp.peopleIds) {
      companyCounts.set(pid, (companyCounts.get(pid) ?? 0) + 1);
    }
  }
  const topCompany = [...companyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPerson = topCompany ? people.find((p) => p.id === topCompany[0]) : undefined;

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
