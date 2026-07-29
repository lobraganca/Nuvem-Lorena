import { useState } from "react";
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

  const [peopleQuery, setPeopleQuery] = useState("");

  const following = user.following ?? [];
  const followed = travelers.filter((tr) => following.includes(tr.id));
  // Searching looks across everyone, including who you already follow — you
  // often want a profile you follow, not only a new one to discover.
  const term = peopleQuery.trim().toLowerCase();
  const searchable = term ? travelers : travelers.filter((tr) => !following.includes(tr.id));
  const suggestions = searchable.filter(
    (tr) =>
      !term ||
      tr.name.toLowerCase().includes(term) ||
      tr.username.toLowerCase().includes(term) ||
      tr.homeCity.toLowerCase().includes(term)
  );

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

      {/* While searching, the page is about finding a profile — the feed of
          who you already follow would only push the results off the screen. */}
      {!term && (
        <>
          {followed.length === 0 && <p className="muted">{t("follow.feedEmpty")}</p>}
          {followed.length > 0 && activity.length === 0 && (
            <p className="muted">{t("follow.feedNoActivity")}</p>
          )}

          <div className="feed-list">
            {activity.map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      <label className="people-search">
        <span className="sr-only">{t("follow.searchPeople")}</span>
        <input
          type="search"
          value={peopleQuery}
          onChange={(e) => setPeopleQuery(e.target.value)}
          placeholder={t("follow.searchPeople")}
        />
      </label>

      {suggestions.length === 0 && term && (
        <p className="muted">{t("follow.searchEmpty", { term: peopleQuery.trim() })}</p>
      )}

      {suggestions.length > 0 && (
        <>
          <h2 className="timeline-title">
            {term ? t("follow.searchResults") : t("follow.discoverTitle")}
          </h2>
          {!term && <p className="muted">{t("follow.discoverSubtitle")}</p>}
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
