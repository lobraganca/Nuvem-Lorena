import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import {
  cancellationPolicies,
  cancellationPolicyDescription,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { adRevenue } from "../lib/ads";
import { bookingStatusLabel, effectiveStatus } from "../lib/bookingStatus";
import { tourTemplates, type TourTemplate } from "../lib/tourTemplates";
import { ImportTours } from "../components/ImportTours";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { ConnectMercadoPago } from "../components/ConnectMercadoPago";
import { BoostTourButton } from "../components/BoostTourButton";
import { EditTour } from "../components/EditTour";
import { TourCalendarEditor } from "../components/TourCalendarEditor";
import type { AccessibilityTag, CancellationPolicy, Difficulty, Tour } from "../types";
import { formatBRL } from "../lib/money";
import { MeetingPointEditor } from "../components/MeetingPointEditor";
import { BusinessEditor } from "../components/BusinessEditor";
import { BusinessReviews } from "../components/BusinessReviews";
import { DeclineBooking } from "../components/DeclineBooking";
import { PayoutStatement } from "../components/PayoutStatement";
import { SettingsRow, rowIcon } from "../components/SettingsRow";
import { newId } from "../lib/ids";

const today = new Date().toISOString().slice(0, 10);

export function ProfessionalDashboard() {
  const { user, businesses, bookings, boosts, addTourToBusiness, updateTour, touchBusinessPresence } =
    useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  const [title, setTitle] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [capacityPerDay, setCapacityPerDay] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>("moderada");
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [accessibility, setAccessibility] = useState<AccessibilityTag[] | undefined>();
  const [seasonMonths, setSeasonMonths] = useState<number[] | undefined>();
  const [usedTemplate, setUsedTemplate] = useState<string | null>(null);
  const [maxGuests, setMaxGuests] = useState("");
  const [minNights, setMinNights] = useState("");

  // A house is rented by the night; everything else is sold by the person.
  // Derived from what the business said it is, rather than asked again, so the
  // two can never disagree.
  const rental = business?.type === "Temporada";

  /** Fills the form from a template so the agency only corrects the price. */
  function applyTemplate(template: TourTemplate) {
    const v = template.values;
    setTitle(v.title);
    setDescription(v.description ?? "");
    setDurationHours(v.durationHours !== undefined ? String(v.durationHours) : "");
    setCapacityPerDay(v.capacityPerDay !== undefined ? String(v.capacityPerDay) : "");
    setCancellationPolicy(v.cancellationPolicy ?? "moderada");
    setDifficulty(v.difficulty);
    setAccessibility(v.accessibility);
    setSeasonMonths(v.seasonMonths);
    setUsedTemplate(template.id);
  }

  // Presence is a side effect of actually being here, not a switch.
  useEffect(() => {
    if (!business) return;
    touchBusinessPresence(business.id);
    const timer = window.setInterval(() => touchBusinessPresence(business.id), 60_000);
    return () => window.clearInterval(timer);
  }, [business, touchBusinessPresence]);

  if (!business) {
    return (
      <div className="page">
        <h1>Painel profissional</h1>
        <p className="muted">
          Você ainda não tem uma empresa cadastrada no Avena.
        </p>
        <Link to="/business/new?onboarding=1" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  const myBookings = bookings.filter((b) => b.businessId === business.id);
  const earnings = myBookings
    .filter((b) => b.status === "confirmada")
    .reduce((sum, b) => sum + b.businessPayout, 0);
  const boostSpend = adRevenue(boosts.filter((b) => b.businessId === business.id));

  function handleAddTour(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !business) return;
    if (!isPublishable(`${title} ${description}`)) return;
    const tour: Tour = {
      id: newId(),
      title,
      description: description || undefined,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
      capacityPerDay: capacityPerDay ? Number(capacityPerDay) : undefined,
      cancellationPolicy,
      difficulty,
      accessibility,
      seasonMonths,
      ...(rental
        ? {
            pricingUnit: "diaria" as const,
            maxGuests: maxGuests ? Number(maxGuests) : undefined,
            minNights: minNights ? Number(minNights) : undefined,
          }
        : {}),
    };
    addTourToBusiness(business.id, tour);
    setTitle("");
    setDescription("");
    setMaxGuests("");
    setMinNights("");
    setPriceFrom("");
    setDurationHours("");
    setCapacityPerDay("");
    setCancellationPolicy("moderada");
    setDifficulty(undefined);
    setAccessibility(undefined);
    setSeasonMonths(undefined);
    setUsedTemplate(null);
  }

  return (
    <div className="page page-wide">
      <div className="business-header">
        <h1>{business.name}</h1>
        <span className={`plan-badge plan-badge-${business.planTier.toLowerCase()}`}>
          {business.planTier}
        </span>
      </div>
      <p className="muted">
        {business.type} · {business.city}
        {business.state ? `, ${business.state}` : ""} — {business.country}
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{myBookings.length}</div>
          <div className="stat-label">Reservas recebidas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {formatBRL(earnings)}</div>
          <div className="stat-label">Ganhos líquidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">Grátis</div>
          <div className="stat-label">Sua adesão</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            R$ {formatBRL(boostSpend)}
          </div>
          <div className="stat-label">Investido em destaque</div>
        </div>
      </div>

      {/* Onde ficava um convite para "fazer upgrade de plano e pagar uma taxa
          menor em cada reserva": duas coisas que deixaram de ser verdade.
          Não há plano à venda, e nada é descontado da agência — quem paga a
          taxa é o viajante, por cima. */}
      <div className="insight-card">
        Você recebe o preço cheio que anunciou. A taxa de serviço do Avena é
        paga pelo viajante, por cima do valor, e aparece separada na tela dele.
      </div>

      <div className="settings-group-rows">
        <SettingsRow to="/anuncios" icon={rowIcon.star} label="Anúncios" />
      </div>

      <BusinessEditor business={business} />

      {/* Ver a própria página como o viajante vê. Quem publica não enxerga o
          que publicou: o painel mostra campos, e a decisão de reservar
          acontece na outra tela. */}
      <Link to={`/business/${business.id}`} className="btn-outline">
        Ver minha página como o viajante vê
      </Link>

      <MeetingPointEditor business={business} />

      <h2 className="timeline-title">Meus passeios</h2>
      <div className="tour-cards">
        {(business.tours ?? []).length === 0 && (
          <p className="muted">Nenhum passeio publicado ainda.</p>
        )}
        {(business.tours ?? []).map((t) => {
          const availability = availabilityFor(t, bookings, today);
          return (
            <div key={t.id} className="tour-card">
              <div className="timeline-card-title">{t.title}</div>
              <div className="muted">
                {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                {t.durationHours !== undefined && ` · ${t.durationHours}h`}
              </div>
              {/* Said here, in the panel, because the agency is the only one
                  who can fix it — and on the public page all the traveller
                  sees is a tour that cannot be booked, with no reason given
                  that helps anybody. */}
              {!t.priceFrom && (
                <div className="availability-note availability-none">
                  Sem preço, este passeio não recebe reservas. Toque em editar e
                  informe o valor por pessoa.
                </div>
              )}
              {/* Foto não é enfeite: é o que faz alguém tocar no cartão. Um
                  anúncio sem foto ocupa lugar na busca e não converte. */}
              {(t.photos?.length ?? 0) === 0 ? (
                <div className="availability-note availability-none">
                  Sem foto. Este passeio aparece como um retângulo vazio na
                  busca — quase ninguém toca. Adicione ao menos uma.
                </div>
              ) : (
                (t.photos?.length ?? 0) < 3 && (
                  <div className="availability-note">
                    {t.photos?.length === 1 ? "Uma foto" : "Duas fotos"}. Três ou
                    mais é o que costuma dar à pessoa confiança para reservar.
                  </div>
                )
              )}
              <div className="muted">
                Cancelamento {cancellationPolicyLabel[t.cancellationPolicy ?? "moderada"]}
              </div>
              <div className="muted">
                {availability.tracked
                  ? `Vagas hoje: ${availability.remaining}/${availability.capacity}`
                  : "Vagas ilimitadas"}
              </div>
              {/* Pausar em vez de apagar. Um passeio fora de temporada some
                  da busca sem levar junto as avaliações e o histórico — que é
                  o que apagar e recriar destrói. */}
              <button
                type="button"
                className="btn-outline"
                onClick={() => updateTour(business.id, { ...t, paused: !t.paused })}
              >
                {t.paused ? "Voltar a anunciar" : "Pausar anúncio"}
              </button>
              {t.paused && (
                <div className="availability-note">
                  Pausado: não aparece na busca. As reservas já feitas continuam
                  valendo.
                </div>
              )}
              <BoostTourButton tour={t} />
              <EditTour businessId={business.id} tour={t} />
              <TourCalendarEditor businessId={business.id} tour={t} />
            </div>
          );
        })}
      </div>

      <ConnectMercadoPago business={business} />

      <ImportTours businessId={business.id} />

      <form className="experience-form tour-add-form" onSubmit={handleAddTour}>
        <fieldset>
          <legend>Comece por um modelo pronto</legend>
          <p className="muted">
            Escolha o mais parecido com o seu passeio: preenchemos descrição,
            duração, vagas e política de cancelamento. Você só corrige o que for
            diferente e coloca o preço.
          </p>
          <div className="chip-row">
            {tourTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                className={`chip ${usedTemplate === template.id ? "chip-active" : ""}`}
                onClick={() => applyTemplate(template)}
                title={template.hint}
              >
                {template.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          {rental ? "Novo anúncio" : "Novo passeio"}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={rental ? "Ex.: Casa com vista para a serra" : "Nome do passeio"}
            required
          />
        </label>
        <label>
          Descrição do anúncio
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={
              rental
                ? "Quantos quartos, o que tem por perto, o que está incluído."
                : "O que o viajante vai viver nesse passeio?"
            }
          />
        </label>
        <div className="form-row">
          <label>
            {rental ? "Preço por noite (R$)" : "Preço a partir de (R$)"}
            <input
              type="number"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
            />
          </label>

          {rental ? (
            <>
              <label>
                Acomoda até (pessoas)
                <input
                  type="number"
                  min={1}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(e.target.value)}
                />
              </label>
              <label>
                Estadia mínima (noites)
                <input
                  type="number"
                  min={1}
                  value={minNights}
                  onChange={(e) => setMinNights(e.target.value)}
                  placeholder="1"
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Duração (horas)
                <input
                  type="number"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </label>
              <label>
                Vagas por dia (opcional)
                <input
                  type="number"
                  min={1}
                  value={capacityPerDay}
                  onChange={(e) => setCapacityPerDay(e.target.value)}
                  placeholder="Deixe em branco para ilimitado"
                />
              </label>
            </>
          )}
        </div>
        <fieldset>
          <legend>Política de cancelamento</legend>
          <div className="chip-row">
            {cancellationPolicies.map((p) => (
              <button
                type="button"
                key={p}
                className={`chip ${cancellationPolicy === p ? "chip-active" : ""}`}
                onClick={() => setCancellationPolicy(p)}
              >
                {cancellationPolicyLabel[p]}
              </button>
            ))}
          </div>
          <p className="muted">{cancellationPolicyDescription[cancellationPolicy]}</p>
        </fieldset>
        <ModerationNotice text={`${title} ${description}`} />
        <button
          type="submit"
          className="btn-primary"
          disabled={!isPublishable(`${title} ${description}`)}
        >
          {rental ? "Publicar anúncio" : "Publicar passeio"}
        </button>
      </form>

      <PayoutStatement businessId={business.id} />

      <BusinessReviews businessId={business.id} />

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
