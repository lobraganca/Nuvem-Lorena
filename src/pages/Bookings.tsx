import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { ReviewForm } from "../components/ReviewForm";
import {
  cancellationPolicyDescription,
  cancellationPolicyLabel,
  computeRefund,
} from "../lib/cancellation";
import type { Booking } from "../types";

function CancelBooking({ booking }: { booking: Booking }) {
  const { cancelBooking } = useAvena();
  const [confirming, setConfirming] = useState(false);
  const { refundAmount, refundPct } = computeRefund(booking);

  if (!confirming) {
    return (
      <button type="button" className="btn-outline" onClick={() => setConfirming(true)}>
        Cancelar reserva
      </button>
    );
  }

  return (
    <div className="booking-form">
      <p className="muted">
        Política {cancellationPolicyLabel[booking.cancellationPolicy]}:{" "}
        {cancellationPolicyDescription[booking.cancellationPolicy]}
      </p>
      <p>
        Você receberá de volta <strong>R$ {refundAmount.toLocaleString("pt-BR")}</strong> (
        {refundPct}% do valor pago).
      </p>
      <div className="chip-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => cancelBooking(booking.id)}
        >
          Confirmar cancelamento
        </button>
        <button type="button" className="btn-outline" onClick={() => setConfirming(false)}>
          Voltar
        </button>
      </div>
    </div>
  );
}

export function Bookings() {
  const { bookings } = useAvena();
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Minhas reservas</h1>

      {sorted.length === 0 && (
        <p className="muted">
          Nenhuma reserva ainda. Explore os{" "}
          <Link to="/destination">destinos</Link> e feche passeios direto pelo app.
        </p>
      )}

      <div className="timeline">
        {sorted.map((b) => {
          const isPast = b.travelDate < today;
          const isCancelled = b.status === "cancelada";
          return (
            <div key={b.id} className="booking-card">
              <div className="timeline-card-title">
                {b.tourTitle}
                {isCancelled && (
                  <span className="privacy-badge" style={{ marginLeft: 8 }}>
                    Cancelada
                  </span>
                )}
              </div>
              <div className="muted">
                {b.businessName} · {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
                {b.travelers} {b.travelers === 1 ? "pessoa" : "pessoas"}
              </div>
              <div className="booking-breakdown">
                <div>
                  Total pago <strong>R$ {b.totalPrice.toLocaleString("pt-BR")}</strong>
                </div>
                <div className="muted">
                  Taxa de serviço Avena ({Math.round(b.commissionRate * 100)}%): R${" "}
                  {b.commissionAmount.toLocaleString("pt-BR")}
                </div>
                <div className="muted">
                  {b.businessName} recebeu: R$ {b.businessPayout.toLocaleString("pt-BR")}
                </div>
                {isCancelled && (
                  <div className="muted">
                    Reembolsado: R$ {(b.refundAmount ?? 0).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>

              {isCancelled ? null : isPast ? (
                <ReviewForm booking={b} />
              ) : (
                <CancelBooking booking={b} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
