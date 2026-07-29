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
  const today = new Date().toISOString().slice(0, 10);

  // Upcoming first and in chronological order — the next trip is what someone
  // opens this screen to check.
  const upcoming = bookings
    .filter((b) => b.travelDate >= today && b.status === "confirmada")
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  const past = bookings
    .filter((b) => b.travelDate < today || b.status === "cancelada")
    .sort((a, b) => b.travelDate.localeCompare(a.travelDate));

  function BookingCard({ b }: { b: Booking }) {
    const isPast = b.travelDate < today;
    const isCancelled = b.status === "cancelada";
    return (
      <div className="booking-card">
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

        <Link to={`/messages/${b.businessId}`} className="btn-outline">
          Falar com {b.businessName}
        </Link>

        {isCancelled ? null : isPast ? (
          <ReviewForm booking={b} />
        ) : (
          <CancelBooking booking={b} />
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Minhas reservas</h1>

      {bookings.length === 0 && (
        <p className="muted">
          Nenhuma reserva ainda. Explore os{" "}
          <Link to="/destination">destinos</Link> e feche passeios direto pelo app.
        </p>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="timeline-title">Próximas</h2>
          <div className="timeline">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="timeline-title">Anteriores</h2>
          <div className="timeline">
            {past.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
