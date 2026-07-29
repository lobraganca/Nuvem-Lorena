import { Link, useNavigate, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categoryColor } from "../lib/categories";
import { BusinessCard } from "../components/BusinessCard";
import { InviteToMemory } from "../components/InviteToMemory";
import { isImagePhoto } from "../lib/photos";
import { formatBRL } from "../lib/money";

export function ExperienceDetail() {
  const { id } = useParams();
  const { experiences, people, businesses, reviews, deleteExperience } = useAvena();
  const navigate = useNavigate();
  const exp = experiences.find((e) => e.id === id);

  if (!exp) return <div className="page">Experiência não encontrada.</div>;

  const present = people.filter((p) => exp.peopleIds.includes(p.id));
  const localBusinesses = businesses.filter(
    (b) => b.city === exp.city && b.status !== "suspensa"
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>
        <span
          className="category-dot"
          style={{ background: categoryColor[exp.category] }}
          aria-hidden="true"
        />{" "}
        {exp.title}
      </h1>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        <Link to={`/experience/${exp.id}/editar`} className="btn-outline">
          Editar
        </Link>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            if (confirm("Excluir esta experiência? Isso não pode ser desfeito.")) {
              deleteExperience(exp.id);
              navigate("/");
            }
          }}
        >
          Excluir
        </button>
      </div>
      <p className="muted">
        {exp.locationName}, {exp.city}
        {exp.state ? `, ${exp.state}` : ""} — {exp.country} ·{" "}
        {new Date(exp.date).toLocaleDateString("pt-BR")}
      </p>

      {exp.photos.length > 0 && (
        <div className="photo-gallery">
          {exp.photos.map((photo, i) =>
            isImagePhoto(photo) ? (
              <img
                key={i}
                src={photo}
                alt={`${exp.title} — foto ${i + 1}`}
                className="photo-gallery-item"
              />
            ) : (
              <span key={i} className="photo-gallery-emoji" aria-hidden="true">
                {photo}
              </span>
            )
          )}
        </div>
      )}

      {exp.mood && <p>Humor do dia: {exp.mood}</p>}
      {exp.rating && (
        <p>
          Avaliação:{" "}
          <span aria-label={`${exp.rating} de 5 estrelas`}>
            <span className="star-rating" aria-hidden="true">
              {"★".repeat(exp.rating)}
            </span>
            <span className="star-rating star-rating-empty" aria-hidden="true">
              {"★".repeat(5 - exp.rating)}
            </span>
          </span>
        </p>
      )}
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

      <InviteToMemory experience={exp} />

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
          <p>R$ {formatBRL(exp.expenses)}</p>
        </div>
      )}

      {exp.notes && (
        <div className="detail-block">
          <h3>Observações</h3>
          <p>{exp.notes}</p>
        </div>
      )}

      {localBusinesses.length > 0 && (
        <div className="detail-block">
          <h3>Passeios, guias, agências e hotéis em {exp.city}</h3>
          <div className="viator-grid">
            {localBusinesses.map((b) => (
              <BusinessCard key={b.id} business={b} reviews={reviews} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
