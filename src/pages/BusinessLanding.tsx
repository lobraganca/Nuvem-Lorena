import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { plans } from "../lib/plans";

const typeEmoji: Record<string, string> = {
  Agência: "🧭",
  Guia: "🥾",
  Restaurante: "🍽️",
};

export function BusinessLanding() {
  const { businesses } = useAvena();

  return (
    <div className="page page-wide">
      <h1>Para empresas</h1>
      <p className="muted">
        Cadastre sua agência, seu trabalho como guia ou seu restaurante e apareça
        para viajantes que estão vivendo experiências perto de você.
      </p>

      <Link to="/business/new" className="btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
        Cadastrar minha empresa
      </Link>

      <h2 className="timeline-title">Planos</h2>
      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.tier} className={`plan-card plan-${plan.tier.toLowerCase()}`}>
            <h3>{plan.tier}</h3>
            <div className="plan-price">{plan.price}</div>
            <p className="muted">{plan.tagline}</p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="timeline-title">Empresas cadastradas</h2>
      <div className="business-grid">
        {businesses.map((b) => (
          <Link to={`/business/${b.id}`} key={b.id} className="business-card">
            <div className="business-card-top">
              <span>{typeEmoji[b.type]}</span>
              <span className={`plan-badge plan-badge-${b.planTier.toLowerCase()}`}>{b.planTier}</span>
            </div>
            <div className="timeline-card-title">{b.name}</div>
            <div className="muted">
              {b.type} · {b.city}
              {b.state ? `, ${b.state}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
