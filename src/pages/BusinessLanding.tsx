import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { reviewStatsFor } from "../lib/reviews";
import { BusinessCard } from "../components/BusinessCard";
import { serviceFeePercent } from "../lib/pricing";
import { partnerSignupUrl } from "../lib/partnerSite";

export function BusinessLanding() {
  const { businesses, reviews } = useAvena();
  const [sortByReputation, setSortByReputation] = useState(false);
  const partnerUrl = partnerSignupUrl();

  const sorted = [...businesses.filter((b) => b.status !== "suspensa")].sort((a, b) => {
    if (!sortByReputation) return 0;
    return reviewStatsFor(reviews, b.id).avgRating - reviewStatsFor(reviews, a.id).avgRating;
  });

  return (
    <div className="page page-wide">
      {/* The pitch first, and the action under it, before any table of plans. */}
      <section className="announce-hero">
        <h1>
          É simples anunciar no <span className="announce-brand">Avena</span>
        </h1>
        <p className="muted">
          Em poucos passos, sua agência, seu trabalho como guia, sua pousada ou
          seu restaurante aparece para quem já está procurando esse destino.
        </p>
        {partnerUrl ? (
          <a
            className="btn-primary announce-start"
            href={partnerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Começar agora
          </a>
        ) : (
          <Link to="/business/new" className="btn-primary announce-start">
            Começar agora
          </Link>
        )}
      </section>

      <h2 className="timeline-title">Quanto custa estar no Avena</h2>
      <div className="pricing-note">
        <p>
          <strong>Cadastrar é gratuito, e não há mensalidade.</strong> Você
          entra, publica seus passeios e recebe reservas sem pagar nada por
          isso.
        </p>
        <p>
          <strong>Nada é descontado das suas reservas.</strong> O preço que você
          anuncia é o preço que você recebe. Quem paga a taxa de serviço do
          Avena ({serviceFeePercent()}%) é o viajante, somada ao valor — e ela
          aparece separada na tela dele antes de confirmar.
        </p>
        <p className="muted">
          O Avena se sustenta dessa taxa e dos anúncios em destaque, que são
          opcionais e sempre marcados como patrocinados. Se um dia existir um
          plano pago, ele será para aparecer mais — nunca para poder vender.
        </p>
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
