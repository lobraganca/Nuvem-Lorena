import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import {
  cancellationPolicies,
  cancellationPolicyDescription,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { tourTemplates, type TourTemplate } from "../lib/tourTemplates";
import { ImportTours } from "../components/ImportTours";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { BoostTourButton } from "../components/BoostTourButton";
import { EditTour } from "../components/EditTour";
import { TourCalendarEditor } from "../components/TourCalendarEditor";
import type { AccessibilityTag, CancellationPolicy, Difficulty, Tour } from "../types";
import { newId } from "../lib/ids";

const today = new Date().toISOString().slice(0, 10);

/**
 * Os passeios da empresa: a lista, a agenda de cada um, e o formulário de
 * publicar.
 *
 * Saiu do painel, e a razão está numa medição: com tudo junto, o painel tinha
 * sete telas e meia de rolagem e cento e oito botões. Ninguém administra nada
 * assim — procura-se o que se veio fazer e desiste-se no meio. Cada assunto
 * agora tem a sua tela, e o painel virou a porta.
 */
export function ProfessionalTours() {
  const { user, businesses, bookings, addTourToBusiness, updateTour } = useAvena();
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
  // Publicar é coisa que se faz de vez em quando; olhar os passeios é coisa
  // de todo dia. Um formulário de trinta campos aberto por padrão empurra a
  // lista para baixo e faz a tela parecer um cadastro, não um painel.
  const [publicando, setPublicando] = useState(false);

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

  if (!business) {
    return (
      <div className="page">
        <BackLink />
        <h1>Meus passeios</h1>
        <p className="muted">Você ainda não tem uma empresa cadastrada.</p>
        <Link to="/business/new" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  return (
    <div className="page page-wide">
      <BackLink />
      <h1>Meus passeios</h1>

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

      {!publicando ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setPublicando(true)}
        >
          Publicar novo passeio
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setPublicando(false)}
          >
            Fechar
          </button>
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
        </>
      )}
    </div>
  );
}
