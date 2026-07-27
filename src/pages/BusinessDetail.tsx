import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

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
    </div>
  );
}
