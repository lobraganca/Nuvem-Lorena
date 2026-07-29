import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import {
  bookingStatusHint,
  bookingStatusLabel,
  effectiveStatus,
  minutesLeftToPay,
} from "../lib/bookingStatus";
import type { PaymentMethod } from "../types";
import { formatBRL } from "../lib/money";

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

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="page">
        <h1>Reserva não encontrada</h1>
        <Link to="/bookings" className="btn-outline">
          Ver minhas reservas
        </Link>
      </div>
    );
  }

  const status = effectiveStatus(booking);
  const minutesLeft = minutesLeftToPay(booking);

  function pay() {
    setProcessing(true);
    // Stands in for the redirect to the payment provider. Nothing is charged.
    window.setTimeout(() => {
      payBooking(booking!.id, method);
      navigate("/bookings");
    }, 900);
  }

  return (
    <div className="page">
      <Link to="/bookings" className="back-link">
        ← Minhas reservas
      </Link>
      <h1>Pagamento</h1>

      <div className="sandbox-warning" role="note">
        <strong>Ambiente de demonstração.</strong> Nenhuma cobrança é feita e
        nenhum dado de cartão é solicitado ou armazenado. Na versão de produção
        esta tela leva ao provedor de pagamento, que divide o valor entre a
        agência e a Avena automaticamente.
      </div>

      <div className="booking-card">
        <div className="timeline-card-title">{booking.tourTitle}</div>
        <div className="muted">
          {booking.businessName} ·{" "}
          {new Date(booking.travelDate).toLocaleDateString("pt-BR")} ·{" "}
          {booking.travelers}{" "}
          {booking.travelers === 1 ? "pessoa" : "pessoas"}
        </div>
        <div className="booking-breakdown">
          <div>
            Valor total <strong>R$ {formatBRL(booking.totalPrice)}</strong>
          </div>
          <div className="muted">
            Taxa de serviço Avena: R$ {formatBRL(booking.commissionAmount)}
          </div>
          <div className="muted">
            {booking.businessName} recebe: R${" "}
            {formatBRL(booking.businessPayout)}
          </div>
        </div>
      </div>

      {status === "aguardando-pagamento" && (
        <>
          <p className="availability-note">
            {bookingStatusHint[status]} Você tem{" "}
            {minutesLeft === 1 ? "1 minuto" : `${minutesLeft} minutos`} para
            concluir antes que a vaga volte para o passeio.
          </p>

          <fieldset>
            <legend>Forma de pagamento</legend>
            <div className="chip-row">
              {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`chip ${method === m ? "chip-active" : ""}`}
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                >
                  {methodLabel[m]}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="btn-primary"
            onClick={pay}
            disabled={processing}
          >
            {processing ? "Processando…" : `Pagar R$ ${formatBRL(booking.totalPrice)}`}
          </button>
        </>
      )}

      {status === "confirmada" && (
        <p className="availability-note">
          Pagamento aprovado em{" "}
          {booking.payment
            ? new Date(booking.payment.paidAt).toLocaleString("pt-BR")
            : "—"}
          . Comprovante {booking.payment?.reference}.
        </p>
      )}

      {(status === "expirada" || status === "cancelada") && (
        <p className="availability-note availability-none">
          {bookingStatusLabel[status]}. {bookingStatusHint[status]}
        </p>
      )}
    </div>
  );
}
