import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { plans } from "../lib/plans";
import { reviewStatsFor } from "../lib/reviews";
import { BusinessCard } from "../components/BusinessCard";
import { JOINING_FEE, LAUNCH_WAIVER, serviceFeePercent } from "../lib/pricing";

export function BusinessLanding() {
  const { businesses, reviews } = useAvena();
  const [sortByReputation, setSortByReputation] = useState(false);

  const sorted = [...businesses.filter((b) => b.status !== "suspensa")].sort((a, b) => {
    if (!sortByReputation) return 0;
    return reviewStatsFor(reviews, b.id).avgRating - reviewStatsFor(reviews, a.id).avgRating;
  });

  return (
    <div className="page page-wide">
      <h1>Para empresas</h1>
      <p className="muted">
        Cadastre sua agência, seu trabalho como guia, restaurante ou hotel e
        apareça para viajantes que estão vivendo experiências perto de você.
      </p>

      <Link to="/business/new" className="btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
        Cadastrar minha empresa
      </Link>

      <h2 className="timeline-title">Quanto custa estar no Avena</h2>
      <div className="pricing-note">
        <p>
          <strong>
            {LAUNCH_WAIVER
              ? "A adesão é gratuita para os primeiros parceiros."
              : `Adesão: R$ ${JOINING_FEE.toFixed(2).replace(".", ",")}.`}
          </strong>{" "}
          {LAUNCH_WAIVER
            ? "O Avena está começando e ainda tem poucos viajantes — não seria justo cobrar entrada por uma vitrine que ainda está enchendo. Quem entrar agora mantém a isenção depois."
            : "Cobrada uma vez, na entrada."}
        </p>
        <p>
          <strong>Nada é descontado das suas reservas.</strong> O preço que você
          anuncia é o preço que você recebe. Quem paga a taxa de serviço do
          Avena ({serviceFeePercent()}%) é o viajante, somada ao valor — e ela
          aparece separada na tela dele antes de confirmar.
        </p>
        <p className="muted">
          Os planos abaixo são opcionais: servem para aparecer mais, não para
          poder vender. No plano gratuito você recebe reservas do mesmo jeito.
        </p>
      </div>
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

      <div className="business-list-header">
        <h2 className="timeline-title">Empresas cadastradas</h2>
        <button
          type="button"
          className={`chip ${sortByReputation ? "chip-active" : ""}`}
          onClick={() => setSortByReputation((v) => !v)}
        >
          Ordenar por reputação
        </button>
      </div>
      <div className="viator-grid">
        {sorted.map((b) => (
          <BusinessCard key={b.id} business={b} reviews={reviews} />
        ))}
      </div>
    </div>
  );
}
