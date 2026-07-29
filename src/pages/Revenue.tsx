import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { plans, priceMonthlyFor } from "../lib/plans";
import { boostRevenue } from "../lib/boosts";

export function Revenue() {
  const { businesses, bookings, boosts } = useAvena();

  const byTier = plans.map((plan) => {
    const count = businesses.filter((b) => b.planTier === plan.tier).length;
    return { ...plan, count, mrr: count * plan.priceMonthly };
  });

  const mrr = byTier.reduce((sum, t) => sum + t.mrr, 0);

  const commissionTotal = bookings.reduce((sum, b) => sum + b.commissionAmount, 0);
  const bookingsVolume = bookings.reduce((sum, b) => sum + b.totalPrice, 0);

  const adsTotal = boostRevenue(boosts);
  const totalRevenue = mrr + commissionTotal + adsTotal;

  return (
    <div className="page page-wide">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Receita da plataforma</h1>
      <div className="insight-card">
        Tela interna do Avena. Ainda não há login, então este endereço fica
        acessível a quem souber a URL — precisa ser protegido por autenticação
        de administrador antes de ir ao ar.
      </div>
      <p className="muted">
        Visão geral de quanto o Avena fatura com assinaturas de empresas, com a
        taxa de serviço das reservas e com anúncios em destaque.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">R$ {mrr.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Receita mensal de assinaturas (MRR)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {commissionTotal.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Comissões de reservas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {adsTotal.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Anúncios em destaque</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {totalRevenue.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Receita total estimada</div>
        </div>
      </div>

      <h2 className="timeline-title">Assinaturas por plano</h2>
      <div className="collections-grid">
        {byTier.map((t) => (
          <div key={t.tier} className="collection-card">
            <div className="plan-tier-row">
              <span className={`plan-badge plan-badge-${t.tier.toLowerCase()}`}>{t.tier}</span>
              <span className="muted">{t.count} empresas</span>
            </div>
            <div className="collection-title">
              R$ {priceMonthlyFor(t.tier).toLocaleString("pt-BR")}/mês cada
            </div>
            <div className="muted">Subtotal: R$ {t.mrr.toLocaleString("pt-BR")}/mês</div>
          </div>
        ))}
      </div>

      <h2 className="timeline-title">Reservas</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{bookings.length}</div>
          <div className="stat-label">Reservas fechadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {bookingsVolume.toLocaleString("pt-BR")}</div>
          <div className="stat-label">Volume transacionado</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {bookingsVolume > 0 ? Math.round((commissionTotal / bookingsVolume) * 100) : 0}%
          </div>
          <div className="stat-label">Taxa média efetiva</div>
        </div>
      </div>
    </div>
  );
}
