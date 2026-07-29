import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { FollowButton } from "../components/FollowButton";
import { BannerSlot } from "../components/BannerSlot";
import { localeFor, useI18n } from "../i18n";
import type { Traveler, TravelerActivity } from "../types";

function Avatar({ traveler }: { traveler: Traveler }) {
  return (
    <Link
      to={`/traveler/${traveler.id}`}
      className="feed-avatar"
      style={{ background: traveler.avatarColor }}
      aria-label={traveler.name}
    >
      {traveler.name[0]}
    </Link>
  );
}

export function Feed() {
  const { travelers, travelerActivity, user } = useAvena();
  const { t, lang } = useI18n();

  const following = user.following ?? [];
  const followed = travelers.filter((tr) => following.includes(tr.id));
  const suggestions = travelers.filter((tr) => !following.includes(tr.id));

  const activity = travelerActivity
    .filter((a) => following.includes(a.travelerId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const travelerById = new Map(travelers.map((tr) => [tr.id, tr]));

  function ActivityCard({ item }: { item: TravelerActivity }) {
    const traveler = travelerById.get(item.travelerId);
    if (!traveler) return null;

    return (
      <article className="feed-card">
        <div className="feed-card-top">
          <Avatar traveler={traveler} />
          <div>
            <Link to={`/traveler/${traveler.id}`} className="feed-name">
              {traveler.name}
            </Link>
            <div className="muted">
              {item.kind === "reserva"
                ? t("follow.bookedTour", {
                    tour: item.title,
                    business: item.businessName ?? "",
                  })
                : t("follow.registeredMemory", {
                    title: item.title,
                    place: item.place,
                  })}
            </div>
          </div>
        </div>
        <div className="muted feed-card-meta">
          {item.city}
          {item.state ? `, ${item.state}` : ""} ·{" "}
          {new Date(item.date).toLocaleDateString(localeFor(lang))}
          {item.category ? ` · ${item.category}` : ""}
        </div>
        {item.businessId && (
          <Link to={`/business/${item.businessId}`} className="btn-outline">
            {item.businessName}
          </Link>
        )}
      </article>
    );
  }

  return (
    <div className="page page-wide">
      <h1>{t("follow.feedTitle")}</h1>
      <p className="muted">{t("follow.feedSubtitle")}</p>

      <BannerSlot placement="feed-top" />

      {followed.length === 0 && <p className="muted">{t("follow.feedEmpty")}</p>}
      {followed.length > 0 && activity.length === 0 && (
        <p className="muted">{t("follow.feedNoActivity")}</p>
      )}

      <div className="feed-list">
        {activity.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>

      {suggestions.length > 0 && (
        <>
          <h2 className="timeline-title">{t("follow.discoverTitle")}</h2>
          <p className="muted">{t("follow.discoverSubtitle")}</p>
          <div className="traveler-grid">
            {suggestions.map((traveler) => (
              <div key={traveler.id} className="traveler-card">
                <Avatar traveler={traveler} />
                <Link to={`/traveler/${traveler.id}`} className="feed-name">
                  {traveler.name}
                </Link>
                <div className="muted">@{traveler.username}</div>
                <div className="muted">
                  {traveler.homeCity}, {traveler.homeState}
                </div>
                {traveler.isPrivate && (
                  <span className="privacy-badge">{t("profile.private")}</span>
                )}
                <FollowButton traveler={traveler} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
