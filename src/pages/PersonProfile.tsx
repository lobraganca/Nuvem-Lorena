import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { friendshipStats } from "../lib/stats";
import { MapView } from "../components/MapView";
import { categoryEmoji } from "../lib/categories";

export function PersonProfile() {
  const { id } = useParams();
  const { people, experiences } = useAvena();
  const person = people.find((p) => p.id === id);

  if (!person) return <div className="page">Pessoa não encontrada.</div>;

  const stats = friendshipStats(experiences, person.id);
  const sorted = [...stats.shared].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <div className="person-header">
        <div className="avatar" style={{ background: person.avatarColor }}>
          {person.name[0]}
        </div>
        <h1>{person.name}</h1>
      </div>

      <div className="stats-grid">
        <Stat label="Experiências juntos" value={stats.total} />
        <Stat label="Cidades conhecidas" value={stats.cities} />
        <Stat label="Estados visitados" value={stats.states} />
        <Stat label="Países visitados" value={stats.countries} />
        <Stat label="Trilhas feitas" value={stats.trails} />
        <Stat label="Praias" value={stats.beaches} />
        <Stat label="Cachoeiras" value={stats.waterfalls} />
        <Stat label="Avistamentos de animais" value={stats.animalSightings} />
      </div>

      <h2 className="timeline-title">Mapa compartilhado</h2>
      <div className="person-map">
        <MapView experiences={stats.shared} />
      </div>

      <h2 className="timeline-title">Linha do tempo das aventuras</h2>
      <div className="timeline">
        {sorted.length === 0 && <p className="muted">Ainda não vivenciaram experiências juntos.</p>}
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
