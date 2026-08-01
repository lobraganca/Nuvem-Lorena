import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BackLink } from "../components/BackLink";
import { BookTourButton } from "../components/BookTourButton";
import { WishButton } from "../components/WishButton";
import { ReputationBadge } from "../components/ReputationBadge";
import { PresenceDot } from "../components/PresenceDot";
import { MeetingPoint } from "../components/MeetingPoint";
import { TourCard } from "../components/TourCard";
import { reviewStatsFor } from "../lib/reviews";
import { availabilityFor } from "../lib/availability";
import { cancellationLabelKey } from "../lib/cancellation";
import { monthsLeftInSeason, seasonLabel } from "../lib/tourAttributes";
import { isStay } from "../lib/stays";
import { formatBRL } from "../lib/money";
import { accessibilityKey, businessTypeKey, difficultyKey } from "../i18n/domain";
import { useT } from "../i18n";

/**
 * A página de um passeio.
 *
 * Antes, clicar num passeio abria a página da agência inteira: a descrição da
 * empresa, o contato, o mapa, e no meio de tudo uma lista com todos os
 * passeios dela, cada um com preço, vagas, sazonalidade e um formulário de
 * reserva. Quem chegou querendo um passeio tinha de encontrá-lo ali dentro e
 * depois desviar dos outros seis.
 *
 * Aqui a tela responde uma pergunta só: *este* passeio. Quem o faz, quanto
 * custa, quando, o que está incluído, e o botão de reservar. A agência vem
 * depois, em um bloco, junto do que mais ela oferece — que é a ordem em que a
 * pessoa quer as coisas, e não a ordem em que o banco de dados as guarda.
 */
export function TourDetail() {
  const { businessId, tourId } = useParams();
  const { businesses, bookings, reviews } = useAvena();
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const business = businesses.find((b) => b.id === businessId);
  const tour = business?.tours?.find((x) => x.id === tourId);

  if (!business || !tour) {
    return (
      <div className="page">
        <BackLink />
        <h1>{t("common.notFound")}</h1>
        <Link to="/" className="btn-outline">
          {t("common.backHome")}
        </Link>
      </div>
    );
  }

  const stay = isStay(tour);
  const stats = reviewStatsFor(reviews, business.id);
  const availability = availabilityFor(tour, bookings, today);
  const season = seasonLabel(tour.seasonMonths);
  const monthsLeft = monthsLeftInSeason(tour.seasonMonths);
  const others = (business.tours ?? []).filter((x) => x.id !== tour.id);
  const photo = tour.photos?.[0];

  return (
    <div className="page tour-page">
      <BackLink />

      <div className="tour-hero">
        {photo ? (
          <img src={photo} alt={tour.title} className="tour-hero-img" />
        ) : (
          <div className="tour-hero-empty" aria-hidden="true" />
        )}
        <div className="tour-hero-wish">
          <WishButton business={business} tour={tour} />
        </div>
      </div>

      <h1 className="tour-title">{tour.title}</h1>

      <p className="tour-place">
        {business.city}
        {business.state ? `, ${business.state}` : ""}
      </p>

      <div className="tour-price-row">
        {tour.priceFrom !== undefined ? (
          <>
            <strong className="tour-price">R$ {formatBRL(tour.priceFrom)}</strong>
            <span className="muted">{stay ? "por noite" : "por pessoa"}</span>
          </>
        ) : (
          <span className="muted">{t("card.askPrice")}</span>
        )}
      </div>

      {/* Os fatos do passeio em linha, antes de qualquer texto: é o que se lê
          primeiro para decidir se vale continuar lendo. */}
      <div className="tour-facts">
        {tour.durationHours !== undefined && (
          <span className="tour-fact">{tour.durationHours}h</span>
        )}
        {stay && tour.maxGuests !== undefined && (
          <span className="tour-fact">até {tour.maxGuests} hóspedes</span>
        )}
        {stay && tour.minNights !== undefined && (
          <span className="tour-fact">mínimo {tour.minNights} noites</span>
        )}
        {tour.difficulty && (
          <span className="tour-fact">{t(difficultyKey[tour.difficulty])}</span>
        )}
        <span className="tour-fact">
          {t(cancellationLabelKey[tour.cancellationPolicy ?? "moderada"])}
        </span>
      </div>

      {tour.description && <p className="tour-description">{tour.description}</p>}

      {season && (
        <p className="season-note">
          {t("business.bestSeason", { season })}
          {monthsLeft !== null &&
            ` · ${t(monthsLeft === 1 ? "business.seasonLeftOne" : "business.seasonLeft", {
              count: monthsLeft,
            })}`}
        </p>
      )}

      {tour.accessibility && tour.accessibility.length > 0 && (
        <div className="chip-row">
          {tour.accessibility.map((a) => (
            <span key={a} className="access-tag">
              {t(accessibilityKey[a])}
            </span>
          ))}
        </div>
      )}

      {availability.tracked && (
        <p className={`availability-note ${availability.remaining === 0 ? "availability-none" : ""}`}>
          {availability.remaining === 0
            ? t("booking.soldOut")
            : t("booking.spotsAvailable", {
                remaining: availability.remaining,
                capacity: availability.capacity ?? 0,
              })}
        </p>
      )}

      <div className="tour-book">
        <BookTourButton business={business} tour={tour} />
      </div>

      <MeetingPoint business={business} />

      {/* A agência, depois do passeio — quem vende importa, mas não é o que a
          pessoa veio ver. */}
      <section className="tour-seller">
        <h2 className="timeline-title">Quem oferece</h2>
        <Link to={`/business/${business.id}`} className="tour-seller-card">
          <div className="tour-seller-head">
            <strong>{business.name}</strong>
            <PresenceDot business={business} />
          </div>
          <div className="muted">
            {t(businessTypeKey[business.type])} · {business.city}
            {business.state ? `, ${business.state}` : ""}
          </div>
          <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
          {business.description && <p className="muted">{business.description}</p>}
          <span className="tour-seller-more">Ver a página da empresa →</span>
        </Link>
      </section>

      {others.length > 0 && (
        <section className="tour-others">
          <h2 className="timeline-title">Outros passeios de {business.name}</h2>
          <div className="card-rail">
            {others.map((other) => (
              <TourCard key={other.id} business={business} tour={other} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
