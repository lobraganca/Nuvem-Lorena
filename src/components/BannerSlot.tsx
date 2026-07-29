import { useAvena } from "../store/AvenaContext";
import { RESPONSIBLE_TOURISM_BANNER, bannersFor } from "../lib/banners";
import { useT } from "../i18n";
import type { Banner, BannerPlacement } from "../types";

function BannerCard({ banner }: { banner: Banner }) {
  const t = useT();

  const title =
    banner.translationKey === "responsible"
      ? t("banner.responsibleTitle")
      : banner.title;
  const text =
    banner.translationKey === "responsible" ? t("banner.responsibleText") : banner.text;

  return (
    <aside className={`banner banner-${banner.kind}`}>
      {banner.image && <img src={banner.image} alt="" className="banner-image" />}
      <div className="banner-body">
        {/* Paid placements must be identifiable as advertising (CDC art. 36). */}
        {banner.kind === "publicidade" && (
          <span className="banner-tag">{t("banner.advertisement")}</span>
        )}
        <strong className="banner-title">{title}</strong>
        <p className="banner-text">{text}</p>
        {banner.linkUrl && (
          <a
            href={banner.linkUrl}
            className="btn-outline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {banner.linkLabel || t("banner.learnMore")}
          </a>
        )}
      </div>
    </aside>
  );
}

/**
 * Renders whatever banners are scheduled for a fixed slot. Slots are named so
 * a banner can never end up inside a checkout or a legal screen.
 */
export function BannerSlot({ placement }: { placement: BannerPlacement }) {
  const { banners } = useAvena();

  const scheduled = bannersFor(banners, placement);
  // The responsible-tourism message is Avena's default on the home screen and
  // only steps aside when something else is scheduled there.
  const toShow =
    scheduled.length > 0
      ? scheduled
      : placement === "home-top"
        ? [RESPONSIBLE_TOURISM_BANNER]
        : [];

  if (toShow.length === 0) return null;

  return (
    <div className="banner-slot">
      {toShow.map((banner) => (
        <BannerCard key={banner.id} banner={banner} />
      ))}
    </div>
  );
}
