import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { ReviewForm } from "../components/ReviewForm";
import {
  cancellationPolicyDescription,
  cancellationPolicyLabel,
  computeRefund,
} from "../lib/cancellation";
import {
  bookingStatusHint,
  bookingStatusLabel,
  effectiveStatus,
  minutesLeftToPay,
} from "../lib/bookingStatus";
import type { Booking } from "../types";
import { formatBRL } from "../lib/money";

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
        Você receberá de volta <strong>R$ {formatBRL(refundAmount)}</strong> (
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
  const awaiting = bookings
    .filter((b) => effectiveStatus(b) === "aguardando-pagamento")
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  const upcoming = bookings
    .filter((b) => b.travelDate >= today && effectiveStatus(b) === "confirmada")
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  const past = bookings
    .filter((b) => {
      const status = effectiveStatus(b);
      if (status === "aguardando-pagamento") return false;
      return b.travelDate < today || status === "cancelada" || status === "expirada";
    })
    .sort((a, b) => b.travelDate.localeCompare(a.travelDate));

  function BookingCard({ b }: { b: Booking }) {
    const status = effectiveStatus(b);
    const isPast = b.travelDate < today;
    const isCancelled = status === "cancelada";
    const isAwaiting = status === "aguardando-pagamento";
    const isPaid = status === "confirmada";
    return (
      <div className="booking-card">
        <div className="timeline-card-title">
          {b.tourTitle}
          <span className={`booking-status booking-status-${status}`}>
            {bookingStatusLabel[status]}
          </span>
        </div>
        <div className="muted">
          {b.businessName} · {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
          {b.travelers} {b.travelers === 1 ? "pessoa" : "pessoas"}
        </div>
        <div className="booking-breakdown">
          <div>
            {isPaid ? "Total pago" : "Valor"}{" "}
            <strong>R$ {formatBRL(b.totalPrice)}</strong>
          </div>
          <div className="muted">
            Taxa de serviço Avena ({Math.round(b.commissionRate * 100)}%): R${" "}
            {formatBRL(b.commissionAmount)}
          </div>
          <div className="muted">
            {b.businessName} {isPaid ? "recebeu" : "recebe"}: R${" "}
            {formatBRL(b.businessPayout)}
          </div>
          {b.payment && (
            <div className="muted">
              Pago via {b.payment.method === "pix" ? "Pix" : "cartão"} ·
              comprovante {b.payment.reference}
            </div>
          )}
          <div className="muted">{bookingStatusHint[status]}</div>
          {isCancelled && (
            <div className="muted">
              Reembolsado: R$ {(formatBRL(b.refundAmount ?? 0))}
            </div>
          )}
        </div>

        {b.participants?.length > 0 && (
          <div className="participant-list">
            <strong>Participantes</strong>
            {b.participants.map((p, i) => (
              <div key={i} className="muted">
                {p.name} · {p.documentType} {p.document}
              </div>
            ))}
          </div>
        )}

        <div className="chip-row">
          <Link to={`/messages/${b.businessId}`} className="btn-outline">
            Falar com {b.businessName}
          </Link>
          <Link to={`/ajuda/novo?reserva=${b.id}`} className="btn-outline">
            Abrir chamado com a Avena
          </Link>
        </div>

        {isAwaiting && (
          <Link to={`/pagamento/${b.id}`} className="btn-primary">
            Pagar e confirmar · faltam {minutesLeftToPay(b)} min
          </Link>
        )}

        {status === "expirada" && (
          <p className="muted">
            A vaga voltou para o passeio. Você pode reservar de novo na página da
            agência.
          </p>
        )}

        {isCancelled || isAwaiting || status === "expirada" ? null : isPast ? (
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

      {awaiting.length > 0 && (
        <>
          <h2 className="timeline-title">Aguardando pagamento</h2>
          <div className="timeline">
            {awaiting.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </>
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
