import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BannerSlot } from "../components/BannerSlot";
import { doneWishes, openWishes } from "../lib/wishlist";
import { formatBRL } from "../lib/money";
import { localeFor, useI18n } from "../i18n";
import type { WishlistItem } from "../types";

export function Wishlist() {
  const { wishlist, removeWish, toggleWishDone } = useAvena();
  const { t, lang } = useI18n();

  const open = openWishes(wishlist);
  const done = doneWishes(wishlist);

  function WishCard({ wish }: { wish: WishlistItem }) {
    return (
      <div className="booking-card">
        <div className="timeline-card-title">
          <Link to={`/business/${wish.businessId}`}>{wish.title}</Link>
          {wish.doneAt && (
            <span className="booking-status booking-status-confirmada">
              {t("wish.doneLabel")}
            </span>
          )}
        </div>

        <div className="muted">
          {[
            wish.businessName,
            wish.city && `${wish.city}${wish.state ? `, ${wish.state}` : ""}`,
            wish.priceFrom !== undefined &&
              `${t("common.from")} R$ ${formatBRL(wish.priceFrom)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>

        <div className="chip-row">
          {!wish.doneAt && (
            <Link to={`/business/${wish.businessId}`} className="btn-primary">
              {t("wish.seeTour")}
            </Link>
          )}
          {!wish.doneAt && (
            <Link to="/experience/new" className="btn-outline">
              {t("wish.registerMemory")}
            </Link>
          )}
          <button
            type="button"
            className="btn-outline"
            onClick={() => toggleWishDone(wish.id)}
          >
            {t(wish.doneAt ? "wish.undo" : "wish.markDone")}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => removeWish(wish.id)}
          >
            {t("common.remove")}
          </button>
        </div>

        {wish.doneAt && (
          <div className="muted">
            {t("wish.doneOn", {
              date: new Date(wish.doneAt).toLocaleDateString(localeFor(lang)),
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.backHome")}
      </Link>
      <h1>{t("wish.title")}</h1>
      <p className="muted">{t("wish.subtitle")}</p>

      <BannerSlot placement="wishlist-top" />

      <h2 className="timeline-title">
        {open.length === 1 ? t("wish.countOne") : t("wish.count", { count: open.length })}
      </h2>
      {open.length === 0 && (
        <>
          <p className="muted">{t("wish.empty")}</p>
          <Link to="/destination" className="btn-primary">
            {t("wish.browseTours")}
          </Link>
        </>
      )}
      <div className="timeline">
        {open.map((wish) => (
          <WishCard key={wish.id} wish={wish} />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="timeline-title">{t("wish.doneTitle")}</h2>
          <div className="timeline">
            {done.map((wish) => (
              <WishCard key={wish.id} wish={wish} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
