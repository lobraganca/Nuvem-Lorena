import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import type { SupportTicketSubject } from "../types";
import { localeFor, useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";

const subjects: SupportTicketSubject[] = [
  "Problema com uma reserva",
  "Cobrança ou reembolso",
  "Agência ou guia não compareceu",
  "Denúncia de conteúdo",
  "Minha conta e meus dados",
  "Outro assunto",
];

/**
 * The stored subject stays in Portuguese because it is the value the admin
 * panel filters on; only what the traveller reads is translated.
 */
const subjectKey: Record<SupportTicketSubject, TranslationKey> = {
  "Problema com uma reserva": "support.subject.booking",
  "Cobrança ou reembolso": "support.subject.billing",
  "Agência ou guia não compareceu": "support.subject.noShow",
  "Denúncia de conteúdo": "support.subject.report",
  "Minha conta e meus dados": "support.subject.account",
  "Outro assunto": "support.subject.other",
};

export function Support() {
  const { supportTickets, openTicket, bookings } = useAvena();
  const [searchParams] = useSearchParams();
  const [subject, setSubject] = useState<SupportTicketSubject>(
    searchParams.get("reserva") ? "Problema com uma reserva" : "Outro assunto"
  );
  const [message, setMessage] = useState("");
  const [bookingId, setBookingId] = useState(searchParams.get("reserva") ?? "");
  const [protocol, setProtocol] = useState<string | null>(null);
  const { t, lang } = useI18n();

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
        ← {t("common.back")}
      </Link>
      <h1>{t("support.title")}</h1>
      <p className="muted">{t("support.subtitle")}</p>

      {protocol && (
        <div className="insight-card" role="status">
          {t("support.protocolCreated", { protocol })}
        </div>
      )}

      <form className="booking-form" onSubmit={submit}>
        <label>
          {t("support.subject")}
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as SupportTicketSubject)}
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {t(subjectKey[s])}
              </option>
            ))}
          </select>
        </label>

        {bookings.length > 0 && (
          <label>
            {t("support.relatedBooking")}
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">{t("support.none")}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tourTitle} — {new Date(b.travelDate).toLocaleDateString(localeFor(lang))}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          {t("support.whatHappened")}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            minLength={10}
            placeholder={t("support.placeholder")}
          />
        </label>

        <button type="submit" className="btn-primary" disabled={message.trim().length < 10}>
          {t("support.open")}
        </button>
      </form>

      <h2 className="timeline-title">{t("support.myTickets")}</h2>
      {supportTickets.length === 0 && (
        <p className="muted">{t("support.noTickets")}</p>
      )}
      <div className="timeline">
        {supportTickets.map((ticket) => (
          <div key={ticket.id} className="booking-card">
            <div className="timeline-card-title">
              {t(subjectKey[ticket.subject])}
              <span className={`booking-status booking-status-${ticket.status}`}>
                {t(`support.status.${ticket.status}`)}
              </span>
            </div>
            <div className="muted">
              {t("support.protocolOpened", {
                protocol: ticket.protocol,
                date: new Date(ticket.createdAt).toLocaleDateString(localeFor(lang)),
              })}
            </div>
            <p>{ticket.message}</p>
            {ticket.reply && (
              <div className="support-reply">
                <strong>{t("support.reply")}</strong>
                <p>{ticket.reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
