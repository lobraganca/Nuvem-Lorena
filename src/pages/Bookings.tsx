import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { ReviewForm } from "../components/ReviewForm";
import { BannerSlot } from "../components/BannerSlot";
import {
  cancellationDescriptionKey,
  cancellationLabelKey,
  computeRefund,
} from "../lib/cancellation";
import { effectiveStatus, minutesLeftToPay } from "../lib/bookingStatus";
import { canReview } from "../lib/reviewEligibility";
import type { Booking } from "../types";
import { formatBRL } from "../lib/money";
import { useT } from "../i18n";

function CancelBooking({ booking }: { booking: Booking }) {
  const { cancelBooking } = useAvena();
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const { refundAmount, refundPct } = computeRefund(booking);

  if (!confirming) {
    return (
      <button type="button" className="btn-outline" onClick={() => setConfirming(true)}>
        {t("bookings.cancel")}
      </button>
    );
  }

  return (
    <div className="booking-form">
      <p className="muted">
        {t("business.cancellation", {
          policy: t(cancellationLabelKey[booking.cancellationPolicy]),
        })}
        : {t(cancellationDescriptionKey[booking.cancellationPolicy])}
      </p>
      <p>{t("bookings.refundAmount", { amount: formatBRL(refundAmount), pct: refundPct })}</p>
      <div className="chip-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => cancelBooking(booking.id)}
        >
          {t("bookings.confirmCancel")}
        </button>
        <button type="button" className="btn-outline" onClick={() => setConfirming(false)}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}

export function Bookings() {
  const { bookings } = useAvena();
  const t = useT();
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
            {t(`status.${status}`)}
          </span>
        </div>
        <div className="muted">
          {b.businessName} · {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
          {b.travelers} {b.travelers === 1 ? "pessoa" : "pessoas"}
        </div>
        <div className="booking-breakdown">
          <div>
            {t("booking.total")} <strong>R$ {formatBRL(b.totalPrice)}</strong>
          </div>
          <div className="muted">
            {t("booking.serviceFee", {
              pct: Math.round(b.commissionRate * 100),
              amount: formatBRL(b.commissionAmount),
            })}
          </div>
          <div className="muted">
            {t(isPaid ? "booking.businessReceived" : "booking.businessReceives", {
              name: b.businessName,
              amount: formatBRL(b.businessPayout),
            })}
          </div>
          {b.payment && (
            <div className="muted">
              {t("bookings.paidVia", {
                method: t(b.payment.method === "pix" ? "payment.pix" : "payment.card"),
                reference: b.payment.reference,
              })}
            </div>
          )}
          <div className="muted">{t(`statusHint.${status}`)}</div>
          {isCancelled && (
            <div className="muted">
              {t("bookings.refunded", { amount: formatBRL(b.refundAmount ?? 0) })}
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
            {t("bookings.talkTo", { name: b.businessName })}
          </Link>
          <Link to={`/ajuda/novo?reserva=${b.id}`} className="btn-outline">
            {t("bookings.openTicket")}
          </Link>
        </div>

        {isAwaiting && (
          <Link to={`/pagamento/${b.id}`} className="btn-primary">
            {t("bookings.payNow", { minutes: minutesLeftToPay(b) })}
          </Link>
        )}

        {status === "expirada" && (
          <p className="muted">{t("bookings.expiredNote")}</p>
        )}

        {canReview(b) && <ReviewForm booking={b} />}
        {isPaid && !isPast && <CancelBooking booking={b} />}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.backHome")}
      </Link>
      <h1>{t("bookings.title")}</h1>

      <BannerSlot placement="bookings-top" />

      {bookings.length === 0 && (
        <p className="muted">{t("bookings.empty")}</p>
      )}

      {awaiting.length > 0 && (
        <>
          <h2 className="timeline-title">{t("bookings.awaiting")}</h2>
          <div className="timeline">
            {awaiting.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="timeline-title">{t("bookings.upcoming")}</h2>
          <div className="timeline">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="timeline-title">{t("bookings.past")}</h2>
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
