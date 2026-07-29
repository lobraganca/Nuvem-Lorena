import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { buildBusinessRows, computeAdminMetrics } from "../lib/admin";
import { isBoostActive } from "../lib/boosts";
import type { SupportTicket } from "../types";
import { formatBRL } from "../lib/money";

type Tab =
  | "Visão geral"
  | "Empresas"
  | "Reservas"
  | "Anúncios"
  | "Avaliações"
  | "Chamados";

const TABS: Tab[] = [
  "Visão geral",
  "Empresas",
  "Reservas",
  "Anúncios",
  "Avaliações",
  "Chamados",
];

function brl(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="muted admin-hint">{hint}</div>}
    </div>
  );
}

export function Admin() {
  const {
    businesses,
    bookings,
    boosts,
    reviews,
    experiences,
    setBusinessStatus,
    setBusinessVerified,
    removeReview,
    endBoost,
  } = useAvena();

  const [tab, setTab] = useState<Tab>("Visão geral");

  const m = computeAdminMetrics(businesses, bookings, boosts, reviews);
  const rows = buildBusinessRows(businesses, bookings, boosts, reviews);
  const needsAttention = rows.filter((r) => r.flags.length > 0);

  return (
    <div className="page page-wide">
      <Link to="/" className="back-link">
        ← Voltar
      </Link>
      <h1>Painel da administradora</h1>

      <div className="insight-card">
        Tela interna do Avena. Enquanto não houver login, este endereço fica
        acessível a quem souber a URL — proteger com autenticação de
        administradora antes de ir ao ar.
      </div>

      <div className="viator-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`viator-tab ${tab === t ? "viator-tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Visão geral" && (
        <>
          <h2 className="timeline-title">Receita</h2>
          <div className="stats-grid">
            <Stat label="Receita total" value={brl(m.totalRevenue)} hint="Assinaturas + comissões + anúncios" />
            <Stat label="Assinaturas (MRR)" value={brl(m.mrr)} hint="Recorrente por mês" />
            <Stat label="Comissões" value={brl(m.commissionTotal)} hint="Só de reservas não canceladas" />
            <Stat label="Anúncios" value={brl(m.adsTotal)} />
          </div>

          <h2 className="timeline-title">Movimento</h2>
          <div className="stats-grid">
            <Stat label="Volume transacionado" value={brl(m.gmv)} hint="Dinheiro que passou pela plataforma" />
            <Stat label="Taxa média efetiva" value={`${m.effectiveRate}%`} />
            <Stat label="Reservas confirmadas" value={String(m.bookingsConfirmed)} />
            <Stat
              label="Reservas canceladas"
              value={String(m.bookingsCancelled)}
              hint={`${brl(m.refundedTotal)} reembolsados`}
            />
          </div>

          <h2 className="timeline-title">Adesões</h2>
          <div className="stats-grid">
            <Stat label="Empresas cadastradas" value={String(m.businessesTotal)} />
            <Stat label="Ativas" value={String(m.businessesActive)} />
            <Stat label="Suspensas" value={String(m.businessesSuspended)} />
            <Stat label="Verificadas" value={String(m.businessesVerified)} />
          </div>

          <div className="admin-plan-grid">
            {m.planBreakdown.map((p) => (
              <div key={p.tier} className="collection-card">
                <div className="plan-tier-row">
                  <span className={`plan-badge plan-badge-${p.tier.toLowerCase()}`}>
                    {p.tier}
                  </span>
                  <span className="muted">{p.count} empresas</span>
                </div>
                <div className="collection-title">{brl(p.mrr)}/mês</div>
                <div className="muted">{brl(p.priceMonthly)} por empresa</div>
              </div>
            ))}
          </div>

          <h2 className="timeline-title">Comunidade</h2>
          <div className="stats-grid">
            <Stat label="Anúncios ligados agora" value={String(m.activeBoostsCount)} />
            <Stat label="Avaliações" value={String(m.reviewsTotal)} />
            <Stat
              label="Nota média da plataforma"
              value={m.avgRatingPlatform ? String(m.avgRatingPlatform) : "—"}
            />
            <Stat label="Experiências registradas" value={String(experiences.length)} />
          </div>

          {needsAttention.length > 0 && (
            <>
              <h2 className="timeline-title">Precisa da sua atenção</h2>
              <div className="timeline">
                {needsAttention.map((r) => (
                  <div key={r.business.id} className="booking-card">
                    <div className="timeline-card-title">{r.business.name}</div>
                    <div className="muted">
                      {r.business.type} · {r.business.city}
                    </div>
                    <div className="chip-row" style={{ marginTop: 6 }}>
                      {r.flags.map((f) => (
                        <span key={f} className="admin-flag">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="muted admin-note">
            Contagem de viajantes, retenção e origem do tráfego dependem do
            backend com login — hoje o app guarda um usuário só, no próprio
            navegador.
          </p>
        </>
      )}

      {tab === "Empresas" && (
        <>
          <h2 className="timeline-title">{rows.length} empresas</h2>
          <div className="timeline">
            {rows.map((r) => (
              <div key={r.business.id} className="booking-card">
                <div className="admin-row-head">
                  <div>
                    <div className="timeline-card-title">
                      <Link to={`/business/${r.business.id}`}>{r.business.name}</Link>
                    </div>
                    <div className="muted">
                      {r.business.type} · {r.business.city}
                      {r.business.state ? `, ${r.business.state}` : ""} ·{" "}
                      {r.business.cadastur ? `Cadastur ${r.business.cadastur}` : "sem Cadastur"}
                    </div>
                  </div>
                  <span className={`plan-badge plan-badge-${r.business.planTier.toLowerCase()}`}>
                    {r.business.planTier}
                  </span>
                </div>

                <div className="booking-breakdown">
                  <div className="muted">
                    {r.bookings} reservas · {brl(r.gmv)} transacionados
                  </div>
                  <div className="muted">
                    Comissão gerada: {brl(r.commission)} · Anúncios: {brl(r.adSpend)}
                  </div>
                  <div className="muted">
                    {r.reviewCount > 0
                      ? `Nota ${r.avgRating} em ${r.reviewCount} avaliações`
                      : "Sem avaliações"}
                  </div>
                </div>

                {r.flags.length > 0 && (
                  <div className="chip-row">
                    {r.flags.map((f) => (
                      <span key={f} className="admin-flag">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="chip-row">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() =>
                      setBusinessVerified(r.business.id, !r.business.verified)
                    }
                  >
                    {r.business.verified ? "Remover verificação" : "Verificar"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      const suspending = r.business.status !== "suspensa";
                      const ok = confirm(
                        suspending
                          ? `Suspender ${r.business.name}? Ela sai das buscas e não recebe novas reservas. Reservas já feitas continuam válidas.`
                          : `Reativar ${r.business.name}?`
                      );
                      if (ok) {
                        setBusinessStatus(r.business.id, suspending ? "suspensa" : "ativa");
                      }
                    }}
                  >
                    {r.business.status === "suspensa" ? "Reativar" : "Suspender"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "Reservas" && (
        <>
          <h2 className="timeline-title">{bookings.length} reservas</h2>
          {bookings.length === 0 && <p className="muted">Nenhuma reserva ainda.</p>}
          <div className="timeline">
            {[...bookings]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((b) => (
                <div key={b.id} className="booking-card">
                  <div className="admin-row-head">
                    <div>
                      <div className="timeline-card-title">{b.tourTitle}</div>
                      <div className="muted">
                        {b.businessName} ·{" "}
                        {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
                        {b.travelers} {b.travelers === 1 ? "pessoa" : "pessoas"}
                      </div>
                    </div>
                    {b.status === "cancelada" && (
                      <span className="admin-flag">Cancelada</span>
                    )}
                  </div>
                  <div className="booking-breakdown">
                    <div className="muted">
                      {brl(b.totalPrice)} · comissão {brl(b.commissionAmount)} (
                      {Math.round(b.commissionRate * 100)}%) · repasse{" "}
                      {brl(b.businessPayout)}
                    </div>
                    {b.status === "cancelada" && (
                      <div className="muted">
                        Reembolsado: {brl(b.refundAmount ?? 0)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === "Anúncios" && (
        <>
          <h2 className="timeline-title">
            {m.activeBoostsCount} ligados agora · {boosts.length} no total
          </h2>
          {boosts.length === 0 && <p className="muted">Nenhum anúncio contratado ainda.</p>}
          <div className="timeline">
            {[...boosts]
              .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
              .map((boost) => {
                const active = isBoostActive(boost);
                return (
                  <div key={boost.id} className="booking-card">
                    <div className="admin-row-head">
                      <div>
                        <div className="timeline-card-title">{boost.tourTitle}</div>
                        <div className="muted">
                          {boost.businessName} · {boost.days} dias ·{" "}
                          {brl(boost.pricePaid)}
                        </div>
                      </div>
                      <span className={active ? "admin-active" : "muted"}>
                        {active ? "Ligado" : "Encerrado"}
                      </span>
                    </div>
                    <div className="muted">
                      {new Date(boost.startsAt).toLocaleDateString("pt-BR")} até{" "}
                      {new Date(boost.endsAt).toLocaleDateString("pt-BR")}
                    </div>
                    {active && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          if (
                            confirm(
                              "Encerrar este anúncio agora? Ele sai do destaque imediatamente e o valor pago permanece no faturamento."
                            )
                          ) {
                            endBoost(boost.id);
                          }
                        }}
                      >
                        Encerrar destaque
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {tab === "Avaliações" && (
        <>
          <h2 className="timeline-title">{reviews.length} avaliações</h2>
          <p className="muted">
            Remova apenas avaliações que violem os Termos — ofensa, dado pessoal
            ou avaliação falsa. Nota baixa legítima não se apaga.
          </p>
          <div className="review-list" style={{ marginTop: 16 }}>
            {reviews.map((r) => {
              const business = businesses.find((b) => b.id === r.businessId);
              return (
                <div key={r.id} className="review-item">
                  <div className="review-item-top">
                    <strong>{r.authorName}</strong>
                    <span className="star-rating" aria-label={`Nota ${r.rating} de 5`}>
                      {"★".repeat(r.rating)}
                    </span>
                    <span className="muted">
                      {r.recommends ? "Recomenda" : "Não recomenda"}
                    </span>
                  </div>
                  <div className="muted">
                    {business?.name ?? "empresa removida"} · {r.tourTitle}
                  </div>
                  <p>{r.comment}</p>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      if (confirm("Remover esta avaliação? A ação não pode ser desfeita.")) {
                        removeReview(r.id);
                      }
                    }}
                  >
                    Remover avaliação
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "Chamados" && <SupportTickets />}
    </div>
  );
}

/** Where a traveller's complaint about an agency actually lands. */
function SupportTickets() {
  const { supportTickets, replyTicket, resolveTicket, bookings } = useAvena();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const open = supportTickets.filter((t) => t.status !== "resolvido");
  const closed = supportTickets.filter((t) => t.status === "resolvido");

  function Ticket({ ticket }: { ticket: SupportTicket }) {
    const booking = bookings.find((b) => b.id === ticket.bookingId);
    return (
      <div className="booking-card">
        <div className="timeline-card-title">
          {ticket.subject}
          <span className={`booking-status booking-status-${ticket.status}`}>
            {ticket.status}
          </span>
        </div>
        <div className="muted">
          Protocolo {ticket.protocol} ·{" "}
          {new Date(ticket.createdAt).toLocaleString("pt-BR")}
        </div>
        {booking && (
          <div className="muted">
            Reserva: {booking.tourTitle} — {booking.businessName} · R${" "}
            {formatBRL(booking.totalPrice)}
          </div>
        )}
        <p>{ticket.message}</p>

        {ticket.reply && (
          <div className="support-reply">
            <strong>Resposta enviada</strong>
            <p>{ticket.reply}</p>
          </div>
        )}

        {ticket.status !== "resolvido" && (
          <>
            <label>
              Responder
              <textarea
                rows={3}
                value={drafts[ticket.id] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [ticket.id]: e.target.value }))
                }
              />
            </label>
            <div className="chip-row">
              <button
                type="button"
                className="btn-primary"
                disabled={!(drafts[ticket.id] ?? "").trim()}
                onClick={() => {
                  replyTicket(ticket.id, drafts[ticket.id].trim());
                  setDrafts((d) => ({ ...d, [ticket.id]: "" }));
                }}
              >
                Enviar resposta
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => resolveTicket(ticket.id)}
              >
                Marcar como resolvido
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <h2 className="timeline-title">
        {open.length} {open.length === 1 ? "chamado aberto" : "chamados abertos"}
      </h2>
      {supportTickets.length === 0 && (
        <p className="muted">Nenhum chamado aberto até agora.</p>
      )}
      <div className="timeline">
        {open.map((t) => (
          <Ticket key={t.id} ticket={t} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="timeline-title">Resolvidos</h2>
          <div className="timeline">
            {closed.map((t) => (
              <Ticket key={t.id} ticket={t} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
