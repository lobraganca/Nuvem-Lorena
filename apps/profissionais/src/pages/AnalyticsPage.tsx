import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  getProfessional,
  isCurrentlyPlusActive,
  countProfileViews,
  countLeadEvents,
  type ProfessionalWithRating,
} from "../lib/professionals";
import { startSubscriptionCheckout, PRICES } from "../lib/payments";

/**
 * Tela de estatísticas do anúncio — só acessível ao dono e só quando o
 * plano Empresa Plus estiver ativo (ver `isCurrentlyPlusActive`). Números
 * simples em cards, sem gráfico (não obrigatório pela especificação).
 */
export function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [views, setViews] = useState<number | null>(null);
  const [leads, setLeads] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    getProfessional(id).then(setProfessional);
  }, [id]);

  useEffect(() => {
    if (!professional || !isCurrentlyPlusActive(professional)) return;
    countProfileViews(professional.id).then(setViews);
    countLeadEvents(professional.id).then(setLeads);
  }, [professional]);

  async function handleSubscribe() {
    if (!id) return;
    setCheckoutLoading(true);
    setMessage("");
    try {
      const { initPoint } = await startSubscriptionCheckout(id, "plus");
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o checkout do Mercado Pago.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading || !professional) {
    return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  }

  if (!user || user.id !== professional.owner_id) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Você precisa entrar com a conta dona deste anúncio para ver as estatísticas.</p>
      </div>
    );
  }

  if (professional.entity_type !== "pj" || !isCurrentlyPlusActive(professional)) {
    return (
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <h1>Estatísticas — {professional.name}</h1>
        {professional.entity_type !== "pj" ? (
          <p className="card">
            O plano Empresa Plus (analytics do anúncio) só está disponível para anúncios de pessoa jurídica.
          </p>
        ) : (
          <div className="card" style={{ display: "grid", gap: 14 }}>
            <p>
              Assine o <strong>Empresa Plus</strong> para ver quantas pessoas visualizaram seu anúncio, quantos contatos
              (leads) ele gerou e acompanhar sua avaliação média em um só lugar.
            </p>
            {message && <p style={{ color: "var(--color-danger)" }}>{message}</p>}
            <button className="btn btn-gold" onClick={handleSubscribe} disabled={checkoutLoading}>
              {checkoutLoading
                ? "Abrindo checkout…"
                : `Assinar Empresa Plus — R$ ${PRICES.plus.amount.toFixed(2).replace(".", ",")}/mês`}
            </button>
          </div>
        )}
        <p style={{ marginTop: 20 }}>
          <Link to="/painel">Voltar ao painel</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1>Estatísticas — {professional.name}</h1>
      <p className="muted">Dados do seu anúncio, incluídos no plano Empresa Plus.</p>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Visualizações de perfil</p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary-gold)" }}>
            {views ?? "…"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Leads / contatos {professional.contact_mode !== "pay_per_lead" && "(ative pagar por contato para contar)"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary-gold)" }}>
            {professional.contact_mode === "pay_per_lead" ? leads ?? "…" : "N/A"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Avaliação média</p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-accent-teal)" }}>
            {professional.average_rating ? professional.average_rating.toFixed(1) : "—"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Total de avaliações</p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700 }}>{professional.review_count}</p>
        </div>
      </div>

      <p style={{ marginTop: 24 }}>
        <Link to="/painel">Voltar ao painel</Link>
      </p>
    </div>
  );
}
