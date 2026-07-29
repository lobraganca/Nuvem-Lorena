import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { friendshipStats } from "../lib/stats";
import { MapView } from "../components/MapView";
import { categoryColor } from "../lib/categories";
import { useT } from "../i18n";

export function PersonProfile() {
  const { id } = useParams();
  const { people, experiences } = useAvena();
  const t = useT();
  const person = people.find((p) => p.id === id);

  if (!person) return <div className="page">{t("common.notFound")}</div>;

  const stats = friendshipStats(experiences, person.id);
  const sorted = [...stats.shared].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.backHome")}
      </Link>
      <div className="person-header">
        <div className="avatar" style={{ background: person.avatarColor }}>
          {person.name[0]}
        </div>
        <h1>{person.name}</h1>
        <Link to={`/messages/${person.id}`} className="btn-outline">
          {t("business.sendMessage")}
        </Link>
      </div>

      <div className="stats-grid">
        <Stat label={t("person.together")} value={stats.total} />
        <Stat label={t("person.cities")} value={stats.cities} />
        <Stat label={t("person.states")} value={stats.states} />
        <Stat label={t("person.countries")} value={stats.countries} />
        <Stat label={t("person.trails")} value={stats.trails} />
        <Stat label={t("person.beaches")} value={stats.beaches} />
        <Stat label={t("person.waterfalls")} value={stats.waterfalls} />
        <Stat label={t("person.sightings")} value={stats.animalSightings} />
      </div>

      <h2 className="timeline-title">{t("person.sharedMap")}</h2>
      <div className="person-map">
        <MapView experiences={stats.shared} />
      </div>

      <h2 className="timeline-title">{t("person.adventureTimeline")}</h2>
      <div className="timeline">
        {sorted.length === 0 && <p className="muted">{t("person.noneYet")}</p>}
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
