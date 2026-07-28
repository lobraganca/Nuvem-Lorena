import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { commissionRateFor, plans } from "../lib/plans";
import {
  cancellationPolicies,
  cancellationPolicyDescription,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import type { CancellationPolicy, Tour } from "../types";

export function ProfessionalDashboard() {
  const { user, businesses, bookings, addTourToBusiness } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  const [title, setTitle] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>("moderada");

  if (!business) {
    return (
      <div className="page">
        <h1>Painel profissional</h1>
        <p className="muted">
          Você ainda não tem uma empresa cadastrada no Avena.
        </p>
        <Link to="/business/new?onboarding=1" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  const myBookings = bookings.filter((b) => b.businessId === business.id);
  const earnings = myBookings
    .filter((b) => b.status === "confirmada")
    .reduce((sum, b) => sum + b.businessPayout, 0);
  const commissionRate = commissionRateFor(business.planTier);
  const currentPlan = plans.find((p) => p.tier === business.planTier);

  function handleAddTour(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !business) return;
    const tour: Tour = {
      id: crypto.randomUUID(),
      title,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
      cancellationPolicy,
    };
    addTourToBusiness(business.id, tour);
    setTitle("");
    setPriceFrom("");
    setDurationHours("");
    setCancellationPolicy("moderada");
  }

  return (
    <div className="page page-wide">
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

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{myBookings.length}</div>
          <div className="stat-label">Reservas recebidas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {earnings.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Ganhos líquidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(commissionRate * 100)}%</div>
          <div className="stat-label">Taxa Avena no seu plano</div>
        </div>
      </div>

      {currentPlan && currentPlan.tier !== "Avançado" && (
        <div className="insight-card">
          Faça upgrade de plano em{" "}
          <Link to="/business">Para empresas</Link> e pague uma taxa menor em
          cada reserva.
        </div>
      )}

      <h2 className="timeline-title">Meus passeios</h2>
      <div className="tour-cards">
        {(business.tours ?? []).length === 0 && (
          <p className="muted">Nenhum passeio publicado ainda.</p>
        )}
        {(business.tours ?? []).map((t) => (
          <div key={t.id} className="tour-card">
            <div className="timeline-card-title">{t.title}</div>
            <div className="muted">
              {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
              {t.durationHours !== undefined && ` · ${t.durationHours}h`}
            </div>
            <div className="muted">
              Cancelamento {cancellationPolicyLabel[t.cancellationPolicy ?? "moderada"]}
            </div>
          </div>
        ))}
      </div>

      <form className="experience-form tour-add-form" onSubmit={handleAddTour}>
        <label>
          Novo passeio
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do passeio"
            required
          />
        </label>
        <div className="form-row">
          <label>
            Preço a partir de (R$)
            <input
              type="number"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
            />
          </label>
          <label>
            Duração (horas)
            <input
              type="number"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Política de cancelamento</legend>
          <div className="chip-row">
            {cancellationPolicies.map((p) => (
              <button
                type="button"
                key={p}
                className={`chip ${cancellationPolicy === p ? "chip-active" : ""}`}
                onClick={() => setCancellationPolicy(p)}
              >
                {cancellationPolicyLabel[p]}
              </button>
            ))}
          </div>
          <p className="muted">{cancellationPolicyDescription[cancellationPolicy]}</p>
        </fieldset>
        <button type="submit" className="btn-primary">
          Publicar passeio
        </button>
      </form>

      <h2 className="timeline-title">Reservas recebidas</h2>
      <div className="timeline">
        {myBookings.length === 0 && (
          <p className="muted">Nenhuma reserva recebida ainda.</p>
        )}
        {myBookings.map((b) => (
          <div key={b.id} className="booking-card">
            <div className="timeline-card-title">
              {b.tourTitle}
              {b.status === "cancelada" && (
                <span className="privacy-badge" style={{ marginLeft: 8 }}>
                  Cancelada
                </span>
              )}
            </div>
            <div className="muted">
              {new Date(b.travelDate).toLocaleDateString("pt-BR")} · {b.travelers}{" "}
              {b.travelers === 1 ? "pessoa" : "pessoas"}
            </div>
            {b.status === "cancelada" ? (
              <div className="booking-breakdown">
                <div className="muted">
                  Reembolsado ao viajante: R$ {(b.refundAmount ?? 0).toLocaleString("pt-BR")}
                </div>
              </div>
            ) : (
              <div className="booking-breakdown">
                <div className="muted">
                  Total pago: R$ {b.totalPrice.toLocaleString("pt-BR")}
                </div>
                <div className="muted">
                  Taxa Avena ({Math.round(b.commissionRate * 100)}%): R${" "}
                  {b.commissionAmount.toLocaleString("pt-BR")}
                </div>
                <div>
                  Você recebe: <strong>R$ {b.businessPayout.toLocaleString("pt-BR")}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
