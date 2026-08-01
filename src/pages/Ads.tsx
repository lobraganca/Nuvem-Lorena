import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import {
  AD_PACKAGES,
  AD_PRODUCTS,
  adPrice,
  adRevenue,
  isAdLive,
  liveAdForTour,
  type AdPlacement,
} from "../lib/ads";
import { PAYMENTS_ENABLED } from "../lib/payments/mercadopago";
import { formatBRL } from "../lib/money";
import { newId } from "../lib/ids";
import type { Boost } from "../types";

/**
 * Anúncios: onde a empresa compra posição, e vê o que comprou.
 *
 * Numa tela só, e separada do painel, porque isto é dinheiro saindo. Misturado
 * com "publicar passeio" e "reservas recebidas", o botão de contratar vira
 * mais um botão; aqui ele tem o preço ao lado e a lista do que já foi gasto
 * embaixo, que é o que faz alguém decidir com a cabeça no lugar.
 */
export function Ads() {
  const { user, businesses, boosts, addBoost } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  const [tourId, setTourId] = useState("");
  const [placement, setPlacement] = useState<AdPlacement>("cidade");
  const [days, setDays] = useState(AD_PACKAGES[1]);
  const [done, setDone] = useState<string | null>(null);

  if (!business) {
    return (
      <div className="page">
        <BackLink />
        <h1>Anúncios</h1>
        <p className="muted">
          Os anúncios são de uma empresa. Cadastre a sua para começar.
        </p>
        <Link to="/business/new" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  const tours = business.tours ?? [];
  const mine = boosts.filter((b) => b.businessId === business.id);
  const live = mine.filter((b) => isAdLive(b));
  const spent = adRevenue(mine);
  const chosen = tours.find((t) => t.id === tourId) ?? tours[0];
  const total = adPrice(placement, days);
  const alreadyRunning = chosen ? liveAdForTour(boosts, chosen.id) : undefined;

  function contract() {
    if (!business || !chosen) return;
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + days);

    const ad: Boost = {
      id: newId(),
      businessId: business.id,
      businessName: business.name,
      tourId: chosen.id,
      tourTitle: chosen.title,
      placement,
      city: business.city,
      days,
      pricePaid: total,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      // Com servidor, isto fica vazio até o pagamento ser confirmado, e o
      // anúncio não aparece enquanto isso. Sem servidor não há cobrança, e um
      // anúncio que nunca sobe não deixa ninguém testar a tela — então ele
      // nasce pago e a tela diz, em letras, que nada foi cobrado.
      paidAt: PAYMENTS_ENABLED ? undefined : new Date().toISOString(),
    };
    addBoost(ad);
    setDone(
      PAYMENTS_ENABLED
        ? "Anúncio contratado. Ele entra no ar assim que o pagamento for confirmado."
        : "Anúncio criado em modo de demonstração — nada foi cobrado."
    );
  }

  return (
    <div className="page ads-page">
      <BackLink />
      <h1>Anúncios</h1>
      <p className="muted">
        Aparecer no Avena é gratuito. O anúncio compra <strong>posição</strong>:
        seu passeio antes dos outros, sempre marcado como patrocinado.
      </p>

      {tours.length === 0 ? (
        <p className="availability-note availability-none">
          Publique um passeio antes de anunciar — é ele que vai aparecer.
        </p>
      ) : (
        <>
          <h2 className="timeline-title">Contratar</h2>

          <label>
            O que anunciar
            <select value={chosen?.id ?? ""} onChange={(e) => setTourId(e.target.value)}>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          {alreadyRunning && (
            <p className="availability-note">
              Este passeio já está em destaque até{" "}
              {new Date(alreadyRunning.endsAt).toLocaleDateString("pt-BR")}. Um novo
              anúncio começa hoje e corre junto — o que costuma ser dinheiro
              gasto duas vezes pelo mesmo lugar.
            </p>
          )}

          <fieldset>
            <legend>Onde aparecer</legend>
            <div className="ad-products">
              {AD_PRODUCTS.map((p) => (
                <button
                  type="button"
                  key={p.placement}
                  className={`ad-product ${placement === p.placement ? "ad-product-on" : ""}`}
                  onClick={() => setPlacement(p.placement)}
                  aria-pressed={placement === p.placement}
                >
                  <strong>{p.label}</strong>
                  <span className="ad-product-price">
                    R$ {formatBRL(p.dailyPrice)} por dia
                  </span>
                  <span className="muted">{p.what}</span>
                  <span className="muted">{p.who}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Por quanto tempo</legend>
            <div className="chip-row">
              {AD_PACKAGES.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip ${days === d ? "chip-active" : ""}`}
                  onClick={() => setDays(d)}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </fieldset>

          <div className="ad-total">
            <span>Total</span>
            <strong>R$ {formatBRL(total)}</strong>
          </div>

          <button type="button" className="btn-primary" onClick={contract}>
            Contratar anúncio
          </button>

          {done && <p className="availability-note">{done}</p>}

          {!PAYMENTS_ENABLED && (
            <p className="muted">
              Ambiente de demonstração: nenhuma cobrança é feita. Quando o
              pagamento estiver ligado, o anúncio só entra no ar depois de pago.
            </p>
          )}
        </>
      )}

      <h2 className="timeline-title">No ar agora</h2>
      {live.length === 0 ? (
        <p className="muted">Nenhum anúncio no ar.</p>
      ) : (
        <div className="timeline">
          {live.map((a) => (
            <div key={a.id} className="booking-card">
              <div className="timeline-card-title">{a.tourTitle}</div>
              <div className="muted">
                {a.placement === "inicio" ? "Tela inicial" : `Busca em ${a.city}`} ·
                até {new Date(a.endsAt).toLocaleDateString("pt-BR")}
              </div>
              <div className="muted">R$ {formatBRL(a.pricePaid)} por {a.days} dias</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="timeline-title">Histórico</h2>
      <div className="ad-summary">
        <span>{mine.length} anúncios contratados</span>
        <strong>R$ {formatBRL(spent)} investidos</strong>
      </div>
      {/* Sem uma promessa de resultado ao lado do valor gasto: o Avena não mede
          cliques nem visitas ainda, e um número inventado aqui seria a coisa
          mais cara desta tela. */}
      <p className="muted">
        Ainda não medimos quantas pessoas viram ou tocaram no anúncio. Quando
        isso existir, aparece aqui — até lá, não invento número.
      </p>
    </div>
  );
}
