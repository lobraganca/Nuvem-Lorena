import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categoryEmoji } from "../lib/categories";

export function ExperienceDetail() {
  const { id } = useParams();
  const { experiences, people } = useAvena();
  const exp = experiences.find((e) => e.id === id);

  if (!exp) return <div className="page">Experiência não encontrada.</div>;

  const present = people.filter((p) => exp.peopleIds.includes(p.id));

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>
        {categoryEmoji[exp.category]} {exp.title}
      </h1>
      <p className="muted">
        {exp.locationName}, {exp.city}
        {exp.state ? `, ${exp.state}` : ""} — {exp.country} ·{" "}
        {new Date(exp.date).toLocaleDateString("pt-BR")}
      </p>

      {exp.mood && <p>Humor do dia: {exp.mood}</p>}
      {exp.rating && <p>Avaliação: {"⭐".repeat(exp.rating)}</p>}
      {exp.diary && (
        <div className="detail-block">
          <h3>Diário</h3>
          <p>{exp.diary}</p>
        </div>
      )}

      {present.length > 0 && (
        <div className="detail-block">
          <h3>Pessoas presentes</h3>
          <div className="chip-row">
            {present.map((p) => (
              <Link key={p.id} to={`/person/${p.id}`} className="chip" style={{ borderColor: p.avatarColor }}>
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(exp.agency || exp.guide) && (
        <div className="detail-block">
          <h3>Agência e guia</h3>
          <p>
            {exp.agency && <span>Agência: {exp.agency} </span>}
            {exp.guide && <span>Guia: {exp.guide}</span>}
          </p>
        </div>
      )}

      {exp.animalsSeen && exp.animalsSeen.length > 0 && (
        <div className="detail-block">
          <h3>Animais observados</h3>
          <p>{exp.animalsSeen.join(", ")}</p>
        </div>
      )}

      {exp.restaurants && exp.restaurants.length > 0 && (
        <div className="detail-block">
          <h3>Restaurantes</h3>
          <p>{exp.restaurants.join(", ")}</p>
        </div>
      )}

      {exp.expenses !== undefined && (
        <div className="detail-block">
          <h3>Gastos</h3>
          <p>R$ {exp.expenses.toLocaleString("pt-BR")}</p>
        </div>
      )}

      {exp.notes && (
        <div className="detail-block">
          <h3>Observações</h3>
          <p>{exp.notes}</p>
        </div>
      )}
    </div>
  );
}
