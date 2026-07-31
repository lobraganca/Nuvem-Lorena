import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { NotificationBanner } from "../components/NotificationBanner";
import { BannerSlot } from "../components/BannerSlot";
import { AppOffer } from "../components/AppOffer";
import { TourCard } from "../components/TourCard";
import { effectiveStatus } from "../lib/bookingStatus";
import { localeFor, useI18n } from "../i18n";
import { businessTypePluralKey } from "../i18n/domain";
import type { Business, BusinessType, Tour } from "../types";

type Filter = "Tudo" | BusinessType;

const FILTERS: Filter[] = ["Tudo", "Agência", "Guia", "Experiência", "Hotel", "Restaurante"];

/** The mark next to each filter, drawn inline so nothing is fetched for it. */
const FILTER_ICON: Record<Filter, string> = {
  Tudo: "M4 6h16M4 12h16M4 18h10",
  Agência: "M3 18l7-13 4 7 3-4 4 10z",
  Guia: "M9 3 3 5.5v16L9 19l6 2.5 6-2.5v-16L15 5.5 9 3z",
  Experiência: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z",
  Hotel: "M4 20V9l8-5 8 5v11h-6v-6h-4v6z",
  Restaurante: "M7 3v8a2 2 0 0 0 2 2v8M7 3v5m3-5v5M17 3c-1.5 2-2 4-2 7h2v11",
};

export function Home() {
  const { businesses, bookings } = useAvena();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Tudo");

  const live = useMemo(
    () => businesses.filter((b) => b.status !== "suspensa"),
    [businesses]
  );

  /** Every tour on the platform, newest business first, with its owner. */
  const listings = useMemo(() => {
    const all: { business: Business; tour: Tour }[] = [];
    for (const business of live) {
      for (const tour of business.tours ?? []) all.push({ business, tour });
    }
    return all;
  }, [live]);

  const shown = listings.filter(
    ({ business }) => filter === "Tudo" || business.type === filter
  );

  const cities = useMemo(() => {
    const counts = new Map<string, { city: string; state?: string; count: number }>();
    for (const b of live) {
      const found = counts.get(b.city);
      if (found) found.count += 1;
      else counts.set(b.city, { city: b.city, state: b.state, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [live]);

  const upcoming = bookings
    .filter((b) => {
      const status = effectiveStatus(b);
      return (
        (status === "confirmada" || status === "aguardando-pagamento") &&
        b.travelDate >= new Date().toISOString().slice(0, 10)
      );
    })
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  function search(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    navigate(term ? `/destination?city=${encodeURIComponent(term)}` : "/destination");
  }

  return (
    <div className="explore">
      <form className="explore-search" onSubmit={search}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="explore-search-icon">
          <path
            fill="currentColor"
            d="M10.5 3a7.5 7.5 0 1 1-4.7 13.3L3 19.1 1.9 18l2.8-2.8A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"
          />
        </svg>
        <input
          list="explore-cities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("market.title")}
          aria-label={t("market.title")}
        />
        <datalist id="explore-cities">
          {cities.map((c) => (
            <option key={c.city} value={c.city} />
          ))}
        </datalist>
      </form>

      {/* One row of filters, the selected one filled. */}
      <div className="explore-filters">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className={`explore-filter ${filter === option ? "explore-filter-on" : ""}`}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={FILTER_ICON[option]}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {option === "Tudo"
              ? t("market.allCategories")
              : t(businessTypePluralKey[option])}
          </button>
        ))}
      </div>

      <div className="explore-body">
        <NotificationBanner />

        {upcoming.length > 0 && (
          <section className="explore-section">
            <div className="explore-head">
              <h2>{t("home.upcoming")}</h2>
              <Link to="/bookings" className="explore-more">
                {t("market.seeAll")}
              </Link>
            </div>
            <div className="timeline">
              {upcoming.slice(0, 2).map((booking) => (
                <Link to="/bookings" key={booking.id} className="timeline-card">
                  <div>
                    <div className="timeline-card-title">{booking.tourTitle}</div>
                    <div className="muted">
                      {new Date(`${booking.travelDate}T12:00:00`).toLocaleDateString(
                        localeFor(lang)
                      )}{" "}
                      · {booking.businessName}
                    </div>
                  </div>
                  {effectiveStatus(booking) === "aguardando-pagamento" && (
                    <span className="booking-status booking-status-aguardando-pagamento">
                      {t("home.toPay")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="explore-section">
          <div className="explore-head">
            <h2>{t("market.recent")}</h2>
            <Link to="/destination" className="explore-more">
              {t("market.seeAll")}
            </Link>
          </div>
          {shown.length === 0 ? (
            <p className="muted">{t("market.emptyCategory")}</p>
          ) : (
            <div className="card-rail">
              {shown.slice(0, 8).map(({ business, tour }) => (
                <TourCard key={tour.id} business={business} tour={tour} />
              ))}
            </div>
          )}
        </section>

        {/* The institutional banner sits after the first rail: the cards are
            what someone came for, and a message before them is a toll. */}
        <BannerSlot placement="home-top" />

        <section className="explore-section">
          <div className="explore-head">
            <h2>{t("market.destinations")}</h2>
          </div>
          <div className="city-rail">
            {cities.map((c) => (
              <Link
                key={c.city}
                to={`/destination?city=${encodeURIComponent(c.city)}`}
                className="city-chip"
              >
                <span className="city-chip-name">{c.city}</span>
                <span className="muted">
                  {c.count === 1
                    ? t("market.onePartner")
                    : t("market.partners", { count: c.count })}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <AppOffer />
      </div>
    </div>
  );
}
