import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { BOOST_PACKAGES, boostDailyPrice, boostPrice } from "../lib/boosts";
import type { Boost, Business, Tour } from "../types";
import { formatBRL } from "../lib/money";

export function BoostTourButton({
  business,
  tour,
  activeBoost,
}: {
  business: Business;
  tour: Tour;
  activeBoost?: Boost;
}) {
  const { addBoost } = useAvena();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(BOOST_PACKAGES[1]);

  if (activeBoost) {
    const endsAt = new Date(activeBoost.endsAt);
    return (
      <div className="boost-active">
        Em destaque até {endsAt.toLocaleDateString("pt-BR")}
      </div>
    );
  }

  const daily = boostDailyPrice(business.planTier);
  const total = boostPrice(business.planTier, days);

  function confirmBoost() {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + days);

    addBoost({
      id: crypto.randomUUID(),
      businessId: business.id,
      businessName: business.name,
      tourId: tour.id,
      tourTitle: tour.title,
      days,
      pricePaid: total,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Turbinar anúncio
      </button>
    );
  }

  return (
    <div className="booking-form">
      <div className="muted">
        Seu anúncio aparece em destaque na primeira tela dos viajantes, marcado
        como patrocinado.
      </div>

      <div className="chip-row">
        {BOOST_PACKAGES.map((d) => (
          <button
            type="button"
            key={d}
            className={`chip ${days === d ? "chip-active" : ""}`}
            onClick={() => setDays(d)}
          >
            {d} dias
          </button>
        ))}
      </div>

      <div className="booking-breakdown">
        <div className="muted">
          R$ {formatBRL(daily)} por dia no plano {business.planTier}
        </div>
        <div>
          Total por {days} dias:{" "}
          <strong>R$ {formatBRL(total)}</strong>
        </div>
        {business.planTier !== "Avançado" && (
          <div className="muted">
            Planos superiores pagam menos por dia de destaque.
          </div>
        )}
      </div>

      <div className="chip-row">
        <button type="button" className="btn-primary" onClick={confirmBoost}>
          Confirmar destaque
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
