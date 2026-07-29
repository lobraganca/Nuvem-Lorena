import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { NotificationBanner } from "../components/NotificationBanner";
import { PromotedTours } from "../components/PromotedTours";
import { TrendingSection } from "../components/TrendingSection";
import { BannerSlot } from "../components/BannerSlot";
import { AppOffer } from "../components/AppOffer";
import { effectiveStatus } from "../lib/bookingStatus";
import { openWishes } from "../lib/wishlist";
import { categoryColor } from "../lib/categories";
import { localeFor, useI18n } from "../i18n";

/**
 * The home screen: what is yours, and what is next.
 *
 * It used to be the map with the search on top of it and the filters beside
 * it — three different jobs fighting for the same screen. The map moved to the
 * profile, where you go to look at where you have been, and searching has its
 * own tab. What is left here is the part that changes: your next trips, your
 * last memories, what you still want to do.
 */
export function Home() {
  const { experiences, bookings, businesses, wishlist, user } = useAvena();
  const { t, lang } = useI18n();

  const upcoming = bookings
    .filter((b) => {
      const status = effectiveStatus(b);
      return (
        (status === "confirmada" || status === "aguardando-pagamento") &&
        b.travelDate >= new Date().toISOString().slice(0, 10)
      );
    })
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

  const recent = [...experiences]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const wishes = openWishes(wishlist).slice(0, 3);
  const firstName = user.name?.split(" ")[0] ?? "";

  return (
    <div className="page page-wide home-feed">
      <NotificationBanner />
      <BannerSlot placement="home-top" />

      <header className="home-hello">
        <h1>{firstName ? t("home.helloName", { name: firstName }) : t("home.hello")}</h1>
        <p className="muted">{t("home.helloText")}</p>
        <Link to="/experience/new" className="btn-primary">
          {t("home.registerMemory")}
        </Link>
      </header>

      {upcoming.length > 0 && (
        <section>
          <h2 className="timeline-title">{t("home.upcoming")}</h2>
          <div className="timeline">
            {upcoming.map((booking) => {
              const business = businesses.find((b) => b.id === booking.businessId);
              const status = effectiveStatus(booking);
              return (
                <Link to="/bookings" key={booking.id} className="timeline-card">
                  <div>
                    <div className="timeline-card-title">{booking.tourTitle}</div>
                    <div className="muted">
                      {new Date(`${booking.travelDate}T12:00:00`).toLocaleDateString(
                        localeFor(lang)
                      )}
                      {business ? ` · ${business.name}` : ""}
                    </div>
                  </div>
                  {status === "aguardando-pagamento" && (
                    <span className="booking-status booking-status-aguardando-pagamento">
                      {t("home.toPay")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="home-section-head">
            <h2 className="timeline-title">{t("home.recentMemories")}</h2>
            <Link to="/profile" className="home-section-link">
              {t("home.seeMap")}
            </Link>
          </div>
          <div className="timeline">
            {recent.map((exp) => (
              <Link to={`/experience/${exp.id}`} key={exp.id} className="timeline-card">
                <div
                  className="category-dot"
                  style={{ background: categoryColor[exp.category] }}
                  aria-hidden="true"
                />
                <div>
                  <div className="timeline-card-title">{exp.title}</div>
                  <div className="muted">
                    {exp.locationName} ·{" "}
                    {new Date(exp.date).toLocaleDateString(localeFor(lang))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Nothing registered yet: say what this app is for, once, and give the
          one action that starts everything. */}
      {experiences.length === 0 && (
        <section className="empty-cta">
          <h2>{t("home.emptyCtaTitle")}</h2>
          <p className="muted">{t("home.emptyCtaText")}</p>
          <Link to="/experience/new" className="btn-primary">
            {t("home.emptyCtaButton")}
          </Link>
        </section>
      )}

      {wishes.length > 0 && (
        <section>
          <div className="home-section-head">
            <h2 className="timeline-title">{t("nav.wishlist")}</h2>
            <Link to="/desejos" className="home-section-link">
              {t("home.seeAll")}
            </Link>
          </div>
          <div className="timeline">
            {wishes.map((wish) => (
              <Link
                to={`/business/${wish.businessId}`}
                key={wish.id}
                className="timeline-card"
              >
                <div>
                  <div className="timeline-card-title">{wish.title}</div>
                  <div className="muted">
                    {wish.businessName}
                    {wish.city ? ` · ${wish.city}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AppOffer />

      <PromotedTours />
      <TrendingSection />
    </div>
  );
}
