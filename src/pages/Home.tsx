import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { NotificationBanner } from "../components/NotificationBanner";
import { PromotedTours } from "../components/PromotedTours";
import { TrendingSection } from "../components/TrendingSection";
import { BannerSlot } from "../components/BannerSlot";
import { AppOffer } from "../components/AppOffer";
import { effectiveStatus } from "../lib/bookingStatus";
import { localeFor, useI18n } from "../i18n";
import { businessTypePluralKey } from "../i18n/domain";
import type { BusinessType } from "../types";

const TYPES: BusinessType[] = ["Agência", "Guia", "Hotel", "Restaurante"];

/**
 * The home screen: where are you going, and what is there.
 *
 * The app is a marketplace first now. Someone arriving wants to say where they
 * are going and see what they can hire there — the way you open a delivery app
 * and it asks for your address. The travelling diary did not disappear, it
 * moved to the profile, where you go to look back rather than to buy.
 */
export function Home() {
  const { businesses, experiences, bookings } = useAvena();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const cities = useMemo(() => {
    const live = businesses.filter((b) => b.status !== "suspensa");
    const counts = new Map<string, { city: string; state?: string; count: number }>();
    for (const b of live) {
      const found = counts.get(b.city);
      if (found) found.count += 1;
      else counts.set(b.city, { city: b.city, state: b.state, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [businesses]);

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
    <div className="market-home">
      {/* The question the whole app is organised around. */}
      <section className="market-hero">
        <h1>{t("market.title")}</h1>
        <p className="muted">{t("market.subtitle")}</p>
        <form className="market-search" onSubmit={search}>
          <input
            list="market-cities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("market.placeholder")}
            aria-label={t("market.placeholder")}
          />
          <datalist id="market-cities">
            {cities.map((c) => (
              <option key={c.city} value={c.city} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary">
            {t("market.search")}
          </button>
        </form>
      </section>

      <div className="page page-wide market-body">
        <NotificationBanner />
        <BannerSlot placement="home-top" />

        {/* What you can hire, before you have picked anywhere. */}
        <section>
          <h2 className="timeline-title">{t("market.services")}</h2>
          <div className="market-types">
            {TYPES.map((type) => (
              <Link
                key={type}
                to={`/destination?type=${encodeURIComponent(type)}`}
                className="market-type"
              >
                {t(businessTypePluralKey[type])}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="timeline-title">{t("market.destinations")}</h2>
          <div className="market-cities">
            {cities.map((c) => (
              <Link
                key={c.city}
                to={`/destination?city=${encodeURIComponent(c.city)}`}
                className="market-city"
              >
                <span className="market-city-name">{c.city}</span>
                <span className="muted">
                  {c.state ? `${c.state} · ` : ""}
                  {c.count === 1
                    ? t("market.onePartner")
                    : t("market.partners", { count: c.count })}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {upcoming.length > 0 && (
          <section>
            <h2 className="timeline-title">{t("home.upcoming")}</h2>
            <div className="timeline">
              {upcoming.map((booking) => (
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

        <PromotedTours />
        <TrendingSection />

        {/* The diary, as an invitation rather than as the main event. */}
        <section className="market-memories">
          <h2 className="timeline-title">{t("market.memoriesTitle")}</h2>
          <p className="muted">
            {experiences.length === 0
              ? t("market.memoriesEmpty")
              : t("market.memoriesCount", { count: experiences.length })}
          </p>
          <div className="chip-row">
            <Link to="/experience/new" className="btn-outline">
              {t("home.registerMemory")}
            </Link>
            <Link to="/profile" className="btn-outline">
              {t("home.seeMap")}
            </Link>
          </div>
        </section>

        <AppOffer />
      </div>
    </div>
  );
}
