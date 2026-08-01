import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import { bookingStatusLabel, effectiveStatus } from "../lib/bookingStatus";
import { DeclineBooking } from "../components/DeclineBooking";
import { formatBRL } from "../lib/money";

const today = new Date().toISOString().slice(0, 10);

/** As reservas recebidas, em tela própria. */
export function ProfessionalBookings() {
  const { user, businesses, bookings } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  if (!business) {
    return (
      <div className="page">
        <BackLink />
        <h1>Reservas</h1>
        <p className="muted">Você ainda não tem uma empresa cadastrada.</p>
        <Link to="/business/new" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  const myBookings = bookings.filter((b) => b.businessId === business.id);

  return (
    <div className="page page-wide">
      <BackLink />
      <h1>Reservas recebidas</h1>

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
              {b.checkOut ? (
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

            {/* Quem reservou, em cima e por extenso. Chegava um número na tela
                e nada mais: a primeira coisa que se faz ao receber uma reserva
                é falar com a pessoa. */}
            {b.participants?.[0]?.name && (
              <div className="booking-guest">
                <strong>{b.participants[0].name}</strong>
                <Link to={`/messages/${business.id}`} className="btn-outline">
                  Falar com o viajante
                </Link>
              </div>
            )}
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

            {b.status !== "cancelada" &&
              b.travelDate >= today &&
              effectiveStatus(b) !== "expirada" && <DeclineBooking booking={b} />}

            {b.status === "cancelada" ? (
              <div className="booking-breakdown">
                <div className="muted">
                  Reembolsado ao viajante: R$ {(formatBRL(b.refundAmount ?? 0))}
                </div>
                {b.declineReason && (
                  <div className="muted">Você recusou: {b.declineReason}</div>
                )}
              </div>
            ) : (
              <div className="booking-breakdown">
                <div className="muted">
                  O viajante pagou R$ {formatBRL(b.totalPrice)}, dos quais R${" "}
                  {formatBRL(b.serviceFee)} são a taxa de serviço do Avena.
                </div>
                <div>
                  Você recebe: <strong>R$ {formatBRL(b.businessPayout)}</strong>{" "}
                  <span className="muted">— o preço cheio que você anunciou.</span>
                </div>
                {/* Quando o dinheiro cai. Faltava, e para quem vive disso é a
                    linha mais importante da tela. Dito como é hoje, sem
                    inventar prazo: o repasse é do Mercado Pago, não nosso. */}
                <div className="muted">
                  {effectiveStatus(b) === "confirmada"
                    ? "O valor cai direto na sua conta do Mercado Pago, no prazo que ele pratica para a forma de pagamento escolhida — Pix costuma ser no mesmo dia, cartão em até 30 dias. O Avena não retém nada no meio."
                    : "Nada é repassado enquanto o pagamento não for aprovado."}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
