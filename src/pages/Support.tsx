import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import type { SupportTicketSubject } from "../types";

const subjects: SupportTicketSubject[] = [
  "Problema com uma reserva",
  "Cobrança ou reembolso",
  "Agência ou guia não compareceu",
  "Denúncia de conteúdo",
  "Minha conta e meus dados",
  "Outro assunto",
];

const statusLabel = {
  aberto: "Aberto",
  respondido: "Respondido",
  resolvido: "Resolvido",
} as const;

export function Support() {
  const { supportTickets, openTicket, bookings } = useAvena();
  const [searchParams] = useSearchParams();
  const [subject, setSubject] = useState<SupportTicketSubject>(
    searchParams.get("reserva") ? "Problema com uma reserva" : "Outro assunto"
  );
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState(searchParams.get("reserva") ?? "");
  const [protocol, setProtocol] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) return;
    const ticket = openTicket({
      subject,
      message: message.trim(),
      bookingId: bookingId || undefined,
    });
    setProtocol(ticket.protocol);
    setMessage("");
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar
      </Link>
      <h1>Central de ajuda</h1>
      <p className="muted">
        Este canal fala com a Avena, não com a agência. Use quando o problema for
        com a reserva, com a cobrança ou com o próprio atendimento de quem te
        vendeu o passeio.
      </p>

      {protocol && (
        <div className="insight-card" role="status">
          Chamado aberto com o protocolo <strong>{protocol}</strong>. Guarde esse
          número: ele identifica o seu caso em qualquer contato.
        </div>
      )}

      <form className="booking-form" onSubmit={submit}>
        <label>
          Assunto
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as SupportTicketSubject)}
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {bookings.length > 0 && (
          <label>
            Reserva relacionada (opcional)
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">Nenhuma</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tourTitle} — {new Date(b.travelDate).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          O que aconteceu
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            minLength={10}
            placeholder="Conte com o máximo de detalhes: datas, valores e o que já tentou resolver com a agência."
          />
        </label>

        <button type="submit" className="btn-primary" disabled={message.trim().length < 10}>
          Abrir chamado
        </button>
      </form>

      <h2 className="timeline-title">Meus chamados</h2>
      {supportTickets.length === 0 && (
        <p className="muted">Você ainda não abriu nenhum chamado.</p>
      )}
      <div className="timeline">
        {supportTickets.map((t) => (
          <div key={t.id} className="booking-card">
            <div className="timeline-card-title">
              {t.subject}
              <span className={`booking-status booking-status-${t.status}`}>
                {statusLabel[t.status]}
              </span>
            </div>
            <div className="muted">
              Protocolo {t.protocol} · aberto em{" "}
              {new Date(t.createdAt).toLocaleDateString("pt-BR")}
            </div>
            <p>{t.message}</p>
            {t.reply && (
              <div className="support-reply">
                <strong>Resposta da Avena</strong>
                <p>{t.reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
