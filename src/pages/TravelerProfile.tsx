import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { FollowButton } from "../components/FollowButton";
import { localeFor, useI18n } from "../i18n";

export function TravelerProfile() {
  const { id } = useParams();
  const { travelers, travelerActivity, user } = useAvena();
  const { t, lang } = useI18n();

  const traveler = travelers.find((tr) => tr.id === id);
  if (!traveler) return <div className="page">{t("common.notFound")}</div>;

  const following = (user.following ?? []).includes(traveler.id);
  // A private profile shows nothing until it accepts the request.
  const canSee = !traveler.isPrivate || following;

  const activity = travelerActivity
    .filter((a) => a.travelerId === traveler.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const cities = new Set(activity.map((a) => a.city));

  return (
    <div className="page">
      <Link to="/feed" className="back-link">
        ← {t("follow.feedTitle")}
      </Link>

      <div className="ig-header">
        <div
          className="ig-avatar ig-avatar-fallback"
          style={{ background: traveler.avatarColor }}
          aria-hidden="true"
        >
          {traveler.name[0]}
        </div>
        <div className="ig-header-info">
          <div className="ig-header-top">
            <h1 className="ig-username">@{traveler.username}</h1>
            <span
              className={`privacy-badge ${
                traveler.isPrivate ? "privacy-private" : "privacy-public"
              }`}
            >
              {t(traveler.isPrivate ? "profile.private" : "profile.public")}
            </span>
            {(traveler.follows ?? []).includes("me") && (
              <span className="privacy-badge">{t("follow.followsYou")}</span>
            )}
            <FollowButton traveler={traveler} />
          </div>
          <p className="ig-name">{traveler.name}</p>
          <p className="muted">{traveler.bio}</p>
          <p className="muted">
            {traveler.homeCity}, {traveler.homeState}
          </p>

          {canSee && (
            <div className="ig-stats-row">
              <div>
                <strong>{activity.length}</strong>{" "}
                <span className="muted">{t("profile.experiences")}</span>
              </div>
              <div>
                <strong>{cities.size}</strong>{" "}
                <span className="muted">{t("profile.cities")}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!canSee && (
        <div className="insight-card">
          <strong>{t("follow.privateProfile")}</strong>
          <p className="muted">
            {t("follow.privateExplain", { name: traveler.name })}
          </p>
        </div>
      )}

      {canSee && (
        <div className="timeline">
          {activity.map((item) => (
            <div key={item.id} className="timeline-card">
              <div>
                <div className="timeline-card-title">{item.title}</div>
                <div className="muted">
                  {item.place} · {new Date(item.date).toLocaleDateString(localeFor(lang))}
                </div>
                {item.businessId && (
                  <Link to={`/business/${item.businessId}`} className="muted">
                    {item.businessName}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
