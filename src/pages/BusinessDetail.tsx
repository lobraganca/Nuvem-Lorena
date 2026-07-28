import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BookTourButton } from "../components/BookTourButton";

export function BusinessDetail() {
  const { id } = useParams();
  const { businesses } = useAvena();
  const business = businesses.find((b) => b.id === id);

  if (!business) return <div className="page">Empresa não encontrada.</div>;

  return (
    <div className="page">
      <Link to="/business" className="back-link">
        ← Voltar para empresas
      </Link>
      <div className="business-header">
        <h1>{business.name}</h1>
        <span className={`plan-badge plan-badge-${business.planTier.toLowerCase()}`}>
          {business.planTier}
        </span>
      </div>
      <p className="muted">
        {business.type} · {business.city}
        {business.state ? `, ${business.state}` : ""} — {business.country}
      </p>

      <div className="detail-block">
        <h3>Sobre</h3>
        <p>{business.description}</p>
      </div>

      <div className="detail-block">
        <h3>Contato</h3>
        <p>
          {business.email}
          {business.phone ? ` · ${business.phone}` : ""}
          {business.website ? ` · ${business.website}` : ""}
        </p>
      </div>

      {business.tours && business.tours.length > 0 && (
        <div className="detail-block">
          <h3>Passeios disponíveis</h3>
          <div className="tour-cards">
            {business.tours.map((t) => (
              <div key={t.id} className="tour-card">
                <div className="timeline-card-title">{t.title}</div>
                <div className="muted">
                  {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                  {t.durationHours !== undefined && ` · ${t.durationHours}h`}
                </div>
                <BookTourButton business={business} tour={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
