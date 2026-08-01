import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BusinessCard } from "../components/BusinessCard";
import { TrendingSection } from "../components/TrendingSection";
import { PromotedTours } from "../components/PromotedTours";
import { BannerSlot } from "../components/BannerSlot";
import { buildItinerary, splitIntoDays } from "../lib/itineraries";
import { accessibilityTags } from "../lib/tourAttributes";
import { cityFromTerm, businessMatches, resolveCity, suggestionsFor } from "../lib/search";
import type { AccessibilityTag, Business, BusinessType } from "../types";
import { useT } from "../i18n";
import { BackLink } from "../components/BackLink";
import { TourCard } from "../components/TourCard";
import { adsFor } from "../lib/ads";
import { dayState, isBookable, todayISO } from "../lib/calendar";
import { holdsSeat } from "../lib/bookingStatus";
import { reviewStatsFor } from "../lib/reviews";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";
import { isStay } from "../lib/stays";
import { accessibilityKey, businessTypePluralKey, categoryKey } from "../i18n/domain";

type Tab = "Todos" | BusinessType;

const TABS: Tab[] = ["Todos", "Agência", "Guia", "Experiência", "Temporada", "Hotel", "Restaurante"];

export function Destination() {
  const { businesses, experiences, reviews, boosts, bookings } = useAvena();
  const t = useT();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("city") ?? "");
  const [tab, setTab] = useState<Tab>("Todos");
  const [access, setAccess] = useState<AccessibilityTag[]>([]);
  const hoje = todayISO();
  const [quando, setQuando] = useState(searchParams.get("data") ?? "");
  const [quantos, setQuantos] = useState(Number(searchParams.get("pessoas")) || 1);
  const [ordem, setOrdem] = useState<"relevancia" | "preco" | "nota">("relevancia");
  const [tetoPreco, setTetoPreco] = useState("");

  useEffect(() => {
    const city = searchParams.get("city");
    if (city) setQuery(city);
    // Arriving from "what you need" on the home screen lands on that tab
    // already filtered, instead of on everything.
    const type = searchParams.get("type");
    if (type && TABS.includes(type as Tab)) setTab(type as Tab);
  }, [searchParams]);

  // Suspended businesses are hidden from travelers everywhere.
  const brBusinesses = businesses.filter(
    (b) => b.country === "Brasil" && b.status !== "suspensa"
  );
  const brExperiences = experiences.filter((e) => e.country === "Brasil");

  const cities = useMemo(
    () =>
      Array.from(
        new Set([...brBusinesses.map((b) => b.city), ...brExperiences.map((e) => e.city)])
      ).sort(),
    [brBusinesses, brExperiences]
  );

  // Search matches city, business name or tour title, so someone who heard
  // about a specific guide can find them without knowing the city.
  const term = query.trim();
  // Quando o que foi digitado nomeia uma cidade, a lista é daquela cidade e de
  // mais nada. Fora isso — nome de agência, nome de passeio — a busca continua
  // ampla, que é como se encontra um guia de quem se ouviu falar.
  const cidadeBuscada = term ? cityFromTerm(brBusinesses, term) : null;

  const matches = brBusinesses
    .filter((b) =>
      cidadeBuscada ? b.city === cidadeBuscada : businessMatches(b, term)
    )
    .filter((b) => tab === "Todos" || b.type === tab)
    .filter((b) =>
      access.length === 0
        ? true
        : (b.tours ?? []).some((t) =>
            access.every((a) => (t.accessibility ?? []).includes(a))
          )
    );

  // The roteiro follows the same loose matching as the search, so someone who
  // typed "Arraial" sees the roteiro of Arraial do Cabo instead of nothing.
  const filtering = Boolean(term) || tab !== "Todos";

  const searchedCity = resolveCity(cities, term);
  const suggestions = term && matches.length === 0 ? suggestionsFor(brBusinesses, term) : [];

  /**
   * Os anúncios da cidade procurada. Só quando há cidade: um patrocinado no
   * topo de uma busca por nome de agência é anúncio no lugar errado, e o
   * anunciante pagou por quem está escolhendo destino.
   */
  const sponsored = (cidadeBuscada ? adsFor(boosts, "cidade") : [])
    .filter((ad) => ad.city === cidadeBuscada)
    .map((ad) => {
      const business = brBusinesses.find(
        (b) => b.id === ad.businessId && b.status !== "suspensa"
      );
      const tour = business?.tours?.find((x) => x.id === ad.tourId);
      return business && tour ? { ad, business, tour } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const itinerary = searchedCity ? buildItinerary(searchedCity, brExperiences) : null;

  /**
   * Com data escolhida, a lista guarda só quem tem lugar naquele dia para
   * aquele tanto de gente. Uma empresa sem nenhum passeio disponível não
   * aparece — mostrar e só contar o não lá dentro é o que fazia perder tempo.
   */
  function temVaga(b: Business): boolean {
    if (!quando) return true;
    return (b.tours ?? []).some((tour) => {
      const vendidas = bookings
        .filter((x) => x.tourId === tour.id && x.travelDate === quando && holdsSeat(x))
        .reduce((sum, x) => sum + x.travelers, 0);
      if (!isBookable(dayState(tour, quando, vendidas, hoje))) return false;
      if (tour.capacityPerDay !== undefined && tour.capacityPerDay - vendidas < quantos)
        return false;
      if (isStay(tour) && tour.maxGuests !== undefined && tour.maxGuests < quantos)
        return false;
      return true;
    });
  }

  /** O menor preço publicado por uma empresa, para ordenar e para o teto. */
  function menorPreco(b: Business): number {
    const precos = (b.tours ?? [])
      .map((t) => t.priceFrom)
      .filter((x): x is number => x !== undefined);
    return precos.length ? Math.min(...precos) : Infinity;
  }

  const comVaga = matches
    .filter(temVaga)
    .filter((b) => !tetoPreco || menorPreco(b) <= Number(tetoPreco))
    .sort((a, b) => {
      if (ordem === "preco") return menorPreco(a) - menorPreco(b);
      if (ordem === "nota") {
        // Sem avaliação nenhuma a empresa vai para o fim em vez de para o
        // topo: zero avaliações não é nota máxima, e ordenar por nota tem de
        // premiar quem tem histórico.
        const na = reviewStatsFor(reviews, a.id);
        const nb = reviewStatsFor(reviews, b.id);
        if (nb.count === 0 && na.count === 0) return 0;
        if (nb.count === 0) return -1;
        if (na.count === 0) return 1;
        return nb.avgRating - na.avgRating;
      }
      return 0;
    });

  /** Só quem marcou o ponto entra no mapa. */
  const noMapa = comVaga.filter((b) => b.lat != null && b.lng != null);

  return (
    <div className="viator-hero">
      <div className="viator-hero-inner">
        <BackLink />
        <h1>{t("destination.title")}</h1>
        <p className="muted">{t("destination.subtitle")}</p>
        <input
          className="destination-search"
          placeholder={t("destination.placeholder")}
          aria-label={t("destination.searchLabel")}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* Quando e para quantos. Sem isto, a pessoa abria três passeios, um
            por um, para descobrir qual tinha vaga no dia 15 — e a casa de
            temporada só revelava a estadia mínima no fim do caminho. */}
        <div className="search-when">
          <label>
            Quando
            <input
              type="date"
              value={quando}
              min={hoje}
              onChange={(e) => setQuando(e.target.value)}
            />
          </label>
          <label>
            Pessoas
            <input
              type="number"
              min={1}
              value={quantos}
              onChange={(e) => setQuantos(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          {quando && (
            <button type="button" className="chip" onClick={() => setQuando("")}>
              Limpar data
            </button>
          )}
        </div>

        {!filtering && (
          <div className="chip-row" style={{ marginTop: 14, justifyContent: "center" }}>
            {cities.map((city) => (
              <button key={city} className="chip" onClick={() => setQuery(city)}>
                {city}
              </button>
            ))}
          </div>
        )}
      </div>

      {!filtering && (
        <div className="page page-wide">
          <BannerSlot placement="destination-top" />
          <PromotedTours />
          <TrendingSection />
        </div>
      )}

      {filtering && (
        <div className="page page-wide">
          <div className="viator-tabs">
            {TABS.map((option) => (
              <button
                key={option}
                className={`viator-tab ${tab === option ? "viator-tab-active" : ""}`}
                onClick={() => setTab(option)}
              >
                {option === "Todos" ? t("destination.all") : t(businessTypePluralKey[option])}
              </button>
            ))}
          </div>

          <div className="access-filter">
            <span className="muted">{t("destination.accessibility")}</span>
            {accessibilityTags.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${access.includes(a) ? "chip-active" : ""}`}
                onClick={() =>
                  setAccess((prev) =>
                    prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                  )
                }
              >
                {t(accessibilityKey[a])}
              </button>
            ))}
          </div>

          <h2 className="timeline-title">
            {t(comVaga.length === 1 ? "destination.resultsOne" : "destination.results", {
              count: comVaga.length,
              query,
            })}
          </h2>

          {comVaga.length === 0 && (
            <div className="empty-search">
              <p>{t("destination.noResults", { query })}</p>
              {suggestions.length > 0 && (
                <>
                  <p className="muted">{t("destination.didYouMean")}</p>
                  <div className="chip-row">
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="chip"
                        onClick={() => setQuery(s.term)}
                      >
                        {s.label} <span className="muted">· {s.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="muted">{t("destination.searchHint")}</p>
            </div>
          )}

          {/* Patrocinados da cidade buscada, antes da lista e separados dela.
              Rotulados porque a lei exige (CDC art. 36) e porque uma lista em
              que não se sabe o que é anúncio deixa de valer para os dois
              lados. */}
          <div className="search-sort">
            <label>
              Ordenar
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as typeof ordem)}
              >
                <option value="relevancia">Mais relevantes</option>
                <option value="preco">Menor preço</option>
                <option value="nota">Melhor avaliados</option>
              </select>
            </label>
            <label>
              Até R$
              <input
                type="number"
                min={0}
                step={50}
                value={tetoPreco}
                onChange={(e) => setTetoPreco(e.target.value)}
                placeholder="sem limite"
              />
            </label>
          </div>

          {sponsored.length > 0 && (
            <div className="sponsored-block">
              <p className="sponsored-label">Patrocinado</p>
              <div className="card-rail">
                {sponsored.map(({ ad, business, tour }) => (
                  <TourCard key={ad.id} business={business} tour={tour} />
                ))}
              </div>
            </div>
          )}

          {/* O mapa dos resultados. Escolher hospedagem é meio geográfico:
              "perto da praia" e "longe de tudo" não se leem numa lista. Só
              aparece quando alguém marcou o ponto — um mapa vazio é pior que
              nenhum. */}
          {noMapa.length > 0 && (
            <div className="results-map">
              <MapContainer
                center={[noMapa[0].lat as number, noMapa[0].lng as number]}
                zoom={12}
                scrollWheelZoom={false}
                className="results-map-canvas"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {noMapa.map((b) => (
                  <Marker
                    key={b.id}
                    position={[b.lat as number, b.lng as number]}
                    icon={divIcon({
                      html: `<span class="meeting-pin"></span>`,
                      className: "",
                      iconSize: [26, 26],
                      iconAnchor: [13, 26],
                    })}
                  >
                    <Popup>
                      <Link to={`/business/${b.id}`}>{b.name}</Link>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          <div className="viator-grid">
            {comVaga.map((b) => (
              <BusinessCard key={b.id} business={b} reviews={reviews} />
            ))}
          </div>

          {itinerary && (
            <>
              <h2 className="timeline-title">
                {t(
                  itinerary.days === 1
                    ? "destination.itineraryTitleOne"
                    : "destination.itineraryTitle",
                  { days: itinerary.days, city: itinerary.city }
                )}
              </h2>
              <p className="muted">
                {t("destination.itinerarySubtitle", { count: itinerary.basedOn })}
              </p>
              <div className="itinerary">
                {splitIntoDays(itinerary.stops, itinerary.days).map((day, i) => (
                  <div key={i} className="itinerary-day">
                    <div className="itinerary-day-title">
                      {t("destination.day", { n: i + 1 })}
                    </div>
                    {day.map((stop) => (
                      <div key={stop.locationName} className="itinerary-stop">
                        <strong>{stop.locationName}</strong>
                        <span className="muted">
                          {t(categoryKey[stop.category])}
                          {stop.timesVisited > 1
                            ? ` · ${t("destination.visitorCount", { count: stop.timesVisited })}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
