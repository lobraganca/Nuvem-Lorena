import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { effectiveStatus, minutesLeftToPay } from "../lib/bookingStatus";
import { PAYMENTS_ENABLED, createCheckout } from "../lib/payments/mercadopago";
import type { PaymentMethod } from "../types";
import { formatBRL } from "../lib/money";
import { localeFor, useI18n } from "../i18n";

const methodLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
};

export function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bookings, payBooking } = useAvena();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, lang } = useI18n();

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="page">
        <h1>{t("payment.notFound")}</h1>
        <Link to="/bookings" className="btn-outline">
          {t("payment.seeBookings")}
        </Link>
      </div>
    );
  }

  const status = effectiveStatus(booking);
  const minutesLeft = minutesLeftToPay(booking);

  async function pay() {
    setProcessing(true);
    setError(null);

    if (PAYMENTS_ENABLED) {
      try {
        // The backend creates the preference with the agency's token and
        // Avena's commission as marketplace_fee; the browser only follows.
        const session = await createCheckout(booking!);
        window.location.href = session.initPoint;
      } catch {
        setError(t("payment.checkoutFailed"));
        setProcessing(false);
      }
      return;
    }

    // No payment backend configured: stands in for the redirect, charging
    // nothing, so the rest of the flow can still be walked through.
    window.setTimeout(() => {
      payBooking(booking!.id, method);
      navigate("/bookings");
    }, 900);
  }

  return (
    <div className="page">
      <Link to="/bookings" className="back-link">
        ← {t("payment.myBookings")}
      </Link>
      <h1>{t("payment.title")}</h1>

      {!PAYMENTS_ENABLED && (
        <div className="sandbox-warning" role="note">
          <strong>{t("payment.demoTitle")}</strong> {t("payment.demoText")}
        </div>
      )}

      <div className="booking-card">
        <div className="timeline-card-title">{booking.tourTitle}</div>
        <div className="muted">
          {booking.businessName} ·{" "}
          {new Date(booking.travelDate).toLocaleDateString("pt-BR")} ·{" "}
          {booking.travelers}{" "}
          {booking.travelers === 1 ? "pessoa" : "pessoas"}
        </div>
        <div className="booking-breakdown">
          <div className="muted">
            {t("booking.tourPrice")} R$ {formatBRL(booking.subtotal)}
          </div>
          <div className="muted">
            {t("booking.serviceFee", {
              pct: Math.round(booking.serviceFeeRate * 100),
              amount: formatBRL(booking.serviceFee),
            })}
          </div>
          <div className="booking-total">
            {t("booking.total")} <strong>R$ {formatBRL(booking.totalPrice)}</strong>
          </div>
          <div className="muted">
            {t("booking.businessReceives", {
              name: booking.businessName,
              amount: formatBRL(booking.businessPayout),
            })}
          </div>
        </div>
      </div>

      {status === "aguardando-pagamento" && (
        <>
          <p className="availability-note">
            {t(`statusHint.${status}`)}{" "}
            {t("payment.timeLeft", { minutes: minutesLeft })}
          </p>

          <fieldset>
            <legend>{t("payment.method")}</legend>
            <div className="chip-row">
              {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`chip ${method === m ? "chip-active" : ""}`}
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                >
                  {t(m === "pix" ? "payment.pix" : "payment.card")}
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className="form-error">{error}</p>}

          <button
            type="button"
            className="btn-primary"
            onClick={pay}
            disabled={processing}
          >
            {processing
              ? t("payment.processing")
              : t("payment.pay", { amount: formatBRL(booking.totalPrice) })}
          </button>
        </>
      )}

      {status === "confirmada" && (
        <p className="availability-note">
          {t("payment.approved", {
            date: booking.payment
              ? new Date(booking.payment.paidAt).toLocaleString(localeFor(lang))
              : "—",
            reference: booking.payment?.reference ?? "—",
          })}
        </p>
      )}

      {(status === "expirada" || status === "cancelada") && (
        <p className="availability-note availability-none">
          {t(`status.${status}`)}. {t(`statusHint.${status}`)}
        </p>
      )}
    </div>
  );
}
