import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { commissionRateFor, plans } from "../lib/plans";
import {
  cancellationPolicies,
  cancellationPolicyDescription,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { activeBoostForTour, boostRevenue } from "../lib/boosts";
import { bookingStatusLabel, effectiveStatus } from "../lib/bookingStatus";
import { BoostTourButton } from "../components/BoostTourButton";
import { EditTour } from "../components/EditTour";
import type { CancellationPolicy, Tour } from "../types";
import { formatBRL } from "../lib/money";

const today = new Date().toISOString().slice(0, 10);

export function ProfessionalDashboard() {
  const { user, businesses, bookings, boosts, addTourToBusiness } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  const [title, setTitle] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [capacityPerDay, setCapacityPerDay] = useState("");
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
  const boostSpend = boostRevenue(boosts.filter((b) => b.businessId === business.id));

  function handleAddTour(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !business) return;
    const tour: Tour = {
      id: crypto.randomUUID(),
      title,
      description: description || undefined,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
      capacityPerDay: capacityPerDay ? Number(capacityPerDay) : undefined,
      cancellationPolicy,
    };
    addTourToBusiness(business.id, tour);
    setTitle("");
    setDescription("");
    setPriceFrom("");
    setDurationHours("");
    setCapacityPerDay("");
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
          <div className="stat-value">R$ {formatBRL(earnings)}</div>
          <div className="stat-label">Ganhos líquidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(commissionRate * 100)}%</div>
          <div className="stat-label">Taxa Avena no seu plano</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            R$ {formatBRL(boostSpend)}
          </div>
          <div className="stat-label">Investido em destaque</div>
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
        {(business.tours ?? []).map((t) => {
          const availability = availabilityFor(t, bookings, today);
          return (
            <div key={t.id} className="tour-card">
              <div className="timeline-card-title">{t.title}</div>
              <div className="muted">
                {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                {t.durationHours !== undefined && ` · ${t.durationHours}h`}
              </div>
              <div className="muted">
                Cancelamento {cancellationPolicyLabel[t.cancellationPolicy ?? "moderada"]}
              </div>
              <div className="muted">
                {availability.tracked
                  ? `Vagas hoje: ${availability.remaining}/${availability.capacity}`
                  : "Vagas ilimitadas"}
              </div>
              <BoostTourButton
                business={business}
                tour={t}
                activeBoost={activeBoostForTour(boosts, t.id)}
              />
              <EditTour businessId={business.id} tour={t} />
            </div>
          );
        })}
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
        <label>
          Descrição do anúncio
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="O que o viajante vai viver nesse passeio?"
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
          <label>
            Vagas por dia (opcional)
            <input
              type="number"
              min={1}
              value={capacityPerDay}
              onChange={(e) => setCapacityPerDay(e.target.value)}
              placeholder="Deixe em branco para ilimitado"
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
              <span className={`booking-status booking-status-${effectiveStatus(b)}`}>
                {bookingStatusLabel[effectiveStatus(b)]}
              </span>
            </div>
            <div className="muted">
              {new Date(b.travelDate).toLocaleDateString("pt-BR")} · {b.travelers}{" "}
              {b.travelers === 1 ? "pessoa" : "pessoas"}
            </div>
            {effectiveStatus(b) === "aguardando-pagamento" && (
              <p className="muted">
                Vaga reservada, pagamento ainda não aprovado. Só entre na lista de
                embarque depois da confirmação.
              </p>
            )}
            {b.status !== "cancelada" && b.participants?.length > 0 && (
              <div className="participant-list">
                <strong>Lista de participantes</strong>
                {b.participants.map((p, i) => (
                  <div key={i} className="muted">
                    {p.name} · {p.documentType} {p.document}
                    {p.birthDate
                      ? ` · nasc. ${new Date(p.birthDate).toLocaleDateString("pt-BR")}`
                      : ""}
                  </div>
                ))}
              </div>
            )}

            {b.status === "cancelada" ? (
              <div className="booking-breakdown">
                <div className="muted">
                  Reembolsado ao viajante: R$ {(formatBRL(b.refundAmount ?? 0))}
                </div>
              </div>
            ) : (
              <div className="booking-breakdown">
                <div className="muted">
                  Total pago: R$ {formatBRL(b.totalPrice)}
                </div>
                <div className="muted">
                  Taxa Avena ({Math.round(b.commissionRate * 100)}%): R${" "}
                  {formatBRL(b.commissionAmount)}
                </div>
                <div>
                  Você recebe: <strong>R$ {formatBRL(b.businessPayout)}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
