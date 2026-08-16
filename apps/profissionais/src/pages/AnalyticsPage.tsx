import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  getProfessional,
  isCurrentlyPlusActive,
  countProfileViews,
  countContactRequests,
  type ProfessionalWithRating,
} from "../lib/professionals";
import {
  startSubscriptionCheckout,
  startAnnualSubscriptionCheckout,
  startAnnualCheckout,
  annualPrice,
  PRICES,
} from "../lib/payments";
import { BottomSheet } from "../components/BottomSheet";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";

/**
 * Tela de estatísticas do cadastro — só acessível ao dono e só quando o
 * plano Empresa Plus estiver ativo (ver `isCurrentlyPlusActive`). Números
 * simples em cards, sem gráfico (não obrigatório pela especificação).
 */
export function AnalyticsPage() {
  useTituloDaPagina("Números do cadastro");
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [views, setViews] = useState<number | null>(null);
  const [leads, setLeads] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual-card" | "annual-pix" | null>(null);
  const [message, setMessage] = useState("");
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProfessional(id).then(setProfessional);
  }, [id]);

  useEffect(() => {
    if (!professional || !isCurrentlyPlusActive(professional)) return;
    countProfileViews(professional.id).then(setViews);
    countContactRequests(professional.id).then(setLeads);
  }, [professional]);

  async function handleSubscribeMonthly() {
    if (!id) return;
    setCheckoutLoading("monthly");
    setMessage("");
    try {
      const { initPoint } = await startSubscriptionCheckout(id, "plus");
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
    } finally {
      setCheckoutLoading(null);
      setPlanSheetOpen(false);
    }
  }

  /** Anual no cartão: preapproval de 12 meses — renova sozinho todo ano. */
  async function handleSubscribeAnnualCard() {
    if (!id) return;
    setCheckoutLoading("annual-card");
    setMessage("");
    try {
      const { initPoint } = await startAnnualSubscriptionCheckout(id, "plus");
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
    } finally {
      setCheckoutLoading(null);
      setPlanSheetOpen(false);
    }
  }

  /**
   * Anual no Pix/boleto: pagamento único — a renovação é avisada por e-mail
   * pela Edge Function agendada `renew-annual-plans`, mas depende de o dono
   * pagar o link.
   */
  async function handleSubscribeAnnualOneTime() {
    if (!id) return;
    setCheckoutLoading("annual-pix");
    setMessage("");
    try {
      const { initPoint } = await startAnnualCheckout(id, "plus");
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
    } finally {
      setCheckoutLoading(null);
      setPlanSheetOpen(false);
    }
  }

  if (loading || !professional) {
    return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  }

  if (!user || user.id !== professional.owner_id) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Você precisa entrar com a conta dona deste cadastro para ver as estatísticas.</p>
      </div>
    );
  }

  if (professional.entity_type !== "pj" || !isCurrentlyPlusActive(professional)) {
    return (
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <h1>Estatísticas — {professional.name}</h1>
        {professional.entity_type !== "pj" ? (
          <p className="card">
            O plano Empresa Plus (analytics do cadastro) só está disponível para cadastros de pessoa jurídica.
          </p>
        ) : (
          <div className="card" style={{ display: "grid", gap: 14 }}>
            <p>
              Assine o <strong>Empresa Plus</strong> para ver quantas pessoas visualizaram seu cadastro, quantos contatos
              de contato ele gerou e acompanhar sua avaliação média em um só lugar.
            </p>
            {message && <p style={{ color: "var(--color-danger)" }}>{message}</p>}
            <button className="btn btn-primary" onClick={() => setPlanSheetOpen(true)} disabled={checkoutLoading !== null}>
              {`Assinar Empresa Plus — a partir de R$ ${PRICES.plus.amount.toFixed(2).replace(".", ",")}/mês`}
            </button>
          </div>
        )}
        <p style={{ marginTop: 20 }}>
          <Link to="/painel">Voltar ao painel</Link>
        </p>

        {planSheetOpen && (
          <BottomSheet
            title="Assinar Empresa Plus"
            subtitle="Três formas de pagar. As duas do cartão renovam sozinhas; no Pix/boleto a gente avisa por e-mail quando estiver perto de vencer."
            onClose={() => setPlanSheetOpen(false)}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <div className="card" style={{ display: "grid", gap: 8 }}>
                <strong>Mensal no cartão — R$ {PRICES.plus.amount.toFixed(2).replace(".", ",")}/mês</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Renova automaticamente: o Mercado Pago cobra o cartão todo mês, até você cancelar.
                </span>
                <button className="btn btn-teal btn-block" disabled={checkoutLoading === "monthly"} onClick={handleSubscribeMonthly}>
                  {checkoutLoading === "monthly" ? "Abrindo checkout…" : "Assinar mensal no cartão"}
                </button>
              </div>
              <div className="card" style={{ display: "grid", gap: 8 }}>
                <strong>Anual no cartão — R$ {annualPrice("plus").toFixed(2).replace(".", ",")}/ano, 20% off</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Renova automaticamente todo ano — equivalente a R$ {(annualPrice("plus") / 12).toFixed(2).replace(".", ",")}/mês.
                  Só cartão de crédito.
                </span>
                <button
                  className="btn btn-primary btn-block"
                  disabled={checkoutLoading === "annual-card"}
                  onClick={handleSubscribeAnnualCard}
                >
                  {checkoutLoading === "annual-card" ? "Abrindo checkout…" : "Assinar anual no cartão"}
                </button>
              </div>
              <div className="card" style={{ display: "grid", gap: 8 }}>
                <strong>Anual no Pix/boleto — R$ {annualPrice("plus").toFixed(2).replace(".", ",")}/ano, 20% off</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Pagamento único: Pix e boleto não permitem cobrança automática. Quando estiver perto de vencer,
                  mandamos um e-mail com o link já pronto para você renovar.
                </span>
                <button
                  className="btn btn-outline btn-block"
                  disabled={checkoutLoading === "annual-pix"}
                  onClick={handleSubscribeAnnualOneTime}
                >
                  {checkoutLoading === "annual-pix" ? "Abrindo checkout…" : "Pagar anual no Pix/boleto"}
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1>Estatísticas — {professional.name}</h1>
      <p className="muted">Dados do seu cadastro, incluídos no plano Empresa Plus.</p>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Visualizações de perfil</p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary)" }}>
            {views ?? "…"}
          </p>
        </div>
        <div className="card">
          {/* Antes aqui contavam "leads", que só cresciam no modo de pagar
              por contato — aposentado. O número ficava em "N/A" convidando a
              ativar algo que não existe mais para comprar. */}
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Pedidos de contato
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary)" }}>
            {leads ?? "…"}
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
