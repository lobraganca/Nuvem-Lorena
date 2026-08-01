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
import { reviewEligibility, type ReviewBlockReason } from "../lib/reviewEligibility";
import type { Booking } from "../types";
import { formatBRL } from "../lib/money";
import { useT } from "../i18n";
import { MemoryMap } from "../components/MemoryMap";
import { directionsUrl } from "../components/MeetingPoint";
import type { TranslationKey } from "../i18n";

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

/** Why the review form is not there, in words the traveller can act on. */
const REVIEW_BLOCK_KEY: Record<ReviewBlockReason, TranslationKey> = {
  "nao-pagou": "review.blockedNotPaid",
  cancelada: "review.blockedCancelled",
  expirada: "review.blockedExpired",
  "ainda-nao-foi": "review.blockedNotYet",
  "ja-avaliou": "review.alreadyDone",
};

export function Bookings() {
  const { bookings, businesses, cancelBooking } = useAvena();
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

  /** A empresa da reserva, quando ela tem onde encontrar. */
  function local(b: Booking) {
    const empresa = businesses.find((x) => x.id === b.businessId);
    if (!empresa) return null;
    return empresa.meetingPoint || empresa.address || empresa.lat != null
      ? empresa
      : null;
  }

  function BookingCard({ b }: { b: Booking }) {
    const status = effectiveStatus(b);
    const isPast = b.travelDate < today;
    const isCancelled = status === "cancelada";
    const isAwaiting = status === "aguardando-pagamento";
    const isPaid = status === "confirmada";
    const eligibility = reviewEligibility(b);
    return (
      <div className="booking-card">
        <div className="timeline-card-title">
          {b.tourTitle}
          <span className={`booking-status booking-status-${status}`}>
            {t(`status.${status}`)}
          </span>
        </div>
        <div className="muted">
          {b.businessName} ·{" "}
          {b.checkOut ? (
            // A stay is two dates and a number of nights. Showing only the
            // check-in, as this did, hides the half of the booking that says
            // when the person has to leave.
            <>
              {new Date(b.travelDate).toLocaleDateString("pt-BR")} a{" "}
              {new Date(b.checkOut).toLocaleDateString("pt-BR")} · {b.nights}{" "}
              {b.nights === 1 ? "noite" : "noites"} · {b.travelers}{" "}
              {b.travelers === 1 ? "hóspede" : "hóspedes"}
            </>
          ) : (
            <>
              {new Date(b.travelDate).toLocaleDateString("pt-BR")} · {b.travelers}{" "}
              {b.travelers === 1 ? "pessoa" : "pessoas"}
            </>
          )}
        </div>
        <div className="booking-breakdown">
          <div>
            {t("booking.total")} <strong>R$ {formatBRL(b.totalPrice)}</strong>
          </div>
          <div className="muted">
            {t("booking.serviceFee", {
              pct: Math.round(b.serviceFeeRate * 100),
              amount: formatBRL(b.serviceFee),
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


        {/* Onde encontrar, aqui dentro.

            A informação existia só na página da empresa. Quem pagou e chega na
            manhã do passeio não vai lembrar de qual página era: ela precisa
            estar dentro da reserva, que é o que se abre naquela hora. */}
        {!isPast && local(b) && (
          <div className="booking-meeting">
            <strong>Onde encontrar</strong>
            {local(b)!.meetingPoint && <p>{local(b)!.meetingPoint}</p>}
            {local(b)!.address && (
              <p className="muted">
                {local(b)!.address} — {local(b)!.city}
              </p>
            )}
            <a
              className="btn-outline"
              href={directionsUrl(local(b)!)}
              target="_blank"
              rel="noreferrer"
            >
              Como chegar
            </a>
          </div>
        )}

        {/* Either the form, or the reason there is no form. A control that
            silently is not there teaches the person that the app is broken. */}
        {eligibility.allowed ? (
          <ReviewForm booking={b} />
        ) : (
          <p className="muted">{t(REVIEW_BLOCK_KEY[eligibility.reason])}</p>
        )}
        {isPaid && !isPast && <CancelBooking booking={b} />}
        {/* Sem pagamento não há reembolso a calcular, então desistir é um
            toque só. Antes, quem se arrependia tinha de esperar a reserva
            expirar — e a vaga ficava presa nesse tempo, sem que o viajante
            nem a agência pudessem liberá-la. */}
        {status === "aguardando-pagamento" && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => cancelBooking(b.id)}
          >
            Desistir da reserva
          </button>
        )}
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

      {/* Where you have been belongs with where you are going: both are your
          travelling, and neither is a setting. */}
      <div className="trips-memories">
        <div className="explore-head">
          <h2 className="timeline-title">{t("market.memoriesTitle")}</h2>
          <Link to="/experience/new" className="explore-more">
            {t("home.registerMemory")}
          </Link>
        </div>
        <MemoryMap />
      </div>
    </div>
  );
}
