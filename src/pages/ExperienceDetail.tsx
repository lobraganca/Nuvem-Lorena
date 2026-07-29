import { Link, useNavigate, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categoryColor } from "../lib/categories";
import { BusinessCard } from "../components/BusinessCard";
import { InviteToMemory } from "../components/InviteToMemory";
import { isImagePhoto } from "../lib/photos";
import { formatBRL } from "../lib/money";
import { localeFor, useI18n } from "../i18n";

export function ExperienceDetail() {
  const { id } = useParams();
  const { experiences, people, businesses, reviews, deleteExperience } = useAvena();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const exp = experiences.find((e) => e.id === id);

  if (!exp) return <div className="page">{t("common.notFound")}</div>;

  const present = people.filter((p) => exp.peopleIds.includes(p.id));
  const localBusinesses = businesses.filter(
    (b) => b.city === exp.city && b.status !== "suspensa"
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.backHome")}
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
          {t("common.edit")}
        </Link>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            if (confirm(t("experience.confirmDelete"))) {
              deleteExperience(exp.id);
              navigate("/");
            }
          }}
        >
          {t("common.delete")}
        </button>
      </div>
      <p className="muted">
        {exp.locationName}, {exp.city}
        {exp.state ? `, ${exp.state}` : ""} — {exp.country} ·{" "}
        {new Date(exp.date).toLocaleDateString(localeFor(lang))}
      </p>

      {exp.photos.length > 0 && (
        <div className="photo-gallery">
          {exp.photos.map((photo, i) =>
            isImagePhoto(photo) ? (
              <img
                key={i}
                src={photo}
                alt={`${exp.title} ${i + 1}`}
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

      {exp.mood && <p>{t("experience.mood")}: {exp.mood}</p>}
      {exp.rating && (
        <p>
          {t("experience.rating")}:{" "}
          <span aria-label={t("experience.starsLabel", { n: exp.rating })}>
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
          <h3>{t("experience.diary")}</h3>
          <p>{exp.diary}</p>
        </div>
      )}

      {present.length > 0 && (
        <div className="detail-block">
          <h3>{t("experience.peoplePresent")}</h3>
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
          <h3>{t("experience.agencyAndGuide")}</h3>
          <p>
            {exp.agency && <span>{t("experience.agency")}: {exp.agency} </span>}
            {exp.guide && <span>{t("experience.guide")}: {exp.guide}</span>}
          </p>
        </div>
      )}

      {exp.animalsSeen && exp.animalsSeen.length > 0 && (
        <div className="detail-block">
          <h3>{t("experience.animalsSeen")}</h3>
          <p>{exp.animalsSeen.join(", ")}</p>
        </div>
      )}

      {exp.restaurants && exp.restaurants.length > 0 && (
        <div className="detail-block">
          <h3>{t("experience.restaurantsShort")}</h3>
          <p>{exp.restaurants.join(", ")}</p>
        </div>
      )}

      {exp.expenses !== undefined && (
        <div className="detail-block">
          <h3>{t("experience.spending")}</h3>
          <p>R$ {formatBRL(exp.expenses)}</p>
        </div>
      )}

      {exp.notes && (
        <div className="detail-block">
          <h3>{t("experience.notes")}</h3>
          <p>{exp.notes}</p>
        </div>
      )}

      {localBusinesses.length > 0 && (
        <div className="detail-block">
          <h3>{t("experience.nearbyBusinesses", { city: exp.city })}</h3>
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
