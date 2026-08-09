import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  getProfessional,
  countProfileViews,
  countLeadEvents,
  type ProfessionalWithRating,
} from "../lib/professionals";

/**
 * Estatísticas do anúncio, para o dono dele.
 *
 * Era o produto pago "Empresa Plus", e só para empresa. Passou a ser de
 * graça para todo mundo quando as fontes de renda foram reduzidas a três —
 * tela de anúncios, turbinar e selo.
 *
 * A troca não é generosidade: é o número de visualizações que convence
 * alguém a assinar o selo ou turbinar o anúncio. Cobrar por ver o próprio
 * movimento era cobrar justamente pelo argumento de venda — e deixava o
 * autônomo, que é a maioria aqui, sem nunca saber que estava sendo visto.
 */
export function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [views, setViews] = useState<number | null>(null);
  const [leads, setLeads] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    getProfessional(id).then(setProfessional);
  }, [id]);

  useEffect(() => {
    if (!professional) return;
    countProfileViews(professional.id).then(setViews);
    countLeadEvents(professional.id).then(setLeads);
  }, [professional]);

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

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1>Estatísticas — {professional.name}</h1>
      <p className="muted">Dados do seu anúncio, incluídos no plano Empresa Plus.</p>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Visualizações de perfil</p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary)" }}>
            {views ?? "…"}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Leads / contatos {professional.contact_mode !== "pay_per_lead" && "(ative pagar por contato para contar)"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "2rem", fontWeight: 700, color: "var(--color-primary)" }}>
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
