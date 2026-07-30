import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { profileStats } from "../lib/stats";
import { buildCollections } from "../lib/collections";
import { categoryColor } from "../lib/categories";
import { serviceFeePercent } from "../lib/pricing";
import { buildInsights } from "../lib/insights";
import { fileToStoredPhoto } from "../lib/photos";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { MemoryMap } from "../components/MemoryMap";
import { useT } from "../i18n";

export function Profile() {
  const { experiences, people, user, updateUser, bookings } = useAvena();
  const stats = profileStats(experiences);
  const collections = buildCollections(experiences);
  const insights = buildInsights(experiences, people, bookings);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const sortedExperiences = [...experiences].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Routed through the same resizer as memories, so a 5 MB selfie cannot
    // fill the storage on its own.
    fileToStoredPhoto(file)
      .then((photo) => updateUser({ avatarPhoto: photo }))
      .catch(() => alert("Não foi possível usar esta imagem. Tente outra foto."));
  }

  const profileText = `${name} ${username} ${bio}`;

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isPublishable(profileText)) return;
    updateUser({ name, username, bio, isPrivate });
    setEditing(false);
  }

  return (
    <div className="page page-wide">
      <Link to="/" className="back-link">
        ← {t("common.back")}
      </Link>

      <div className="ig-header">
        <button
          type="button"
          className="ig-avatar-btn"
          onClick={() => fileInputRef.current?.click()}
          title={t("profile.changePhoto")}
        >
          {user.avatarPhoto ? (
            <img src={user.avatarPhoto} alt={user.name} className="ig-avatar" />
          ) : (
            <div className="ig-avatar ig-avatar-fallback" style={{ background: user.avatarColor }}>
              {user.name[0]}
            </div>
          )}
          <span className="ig-avatar-edit">{t("common.edit")}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handlePhotoChange}
        />

        <div className="ig-header-info">
          <div className="ig-header-top">
            <h1 className="ig-username">@{user.username}</h1>
            <span className={`privacy-badge ${user.isPrivate ? "privacy-private" : "privacy-public"}`}>
              {t(user.isPrivate ? "profile.private" : "profile.public")}
            </span>
            <span className="privacy-badge">
              {t(user.accountType === "profissional" ? "profile.professional" : "profile.tourist")}
            </span>
            <button className="btn-outline" onClick={() => setEditing((v) => !v)}>
              {t(editing ? "common.cancel" : "profile.editProfile")}
            </button>
            {user.accountType === "profissional" && (
              <Link to="/professional" className="btn-outline">
                {t("profile.goToDashboard")}
              </Link>
            )}
            {/* Account, app and legal live in Ajustes now. This page is for
                looking at your own travelling. */}
            <Link to="/ajustes" className="btn-outline">
              {t("settings.title")}
            </Link>
          </div>

          {/* Only the two lists that belong to the traveller. */}
          <nav className="profile-menu" aria-label={t("nav.moreOptions")}>
            <Link to="/desejos">{t("nav.wishlist")}</Link>
            <Link to="/feed">{t("nav.people")}</Link>
          </nav>

          <div className="ig-stats-row">
            <div>
              <strong>{stats.total}</strong> <span className="muted">{t("profile.experiences")}</span>
            </div>
            <div>
              <strong>{stats.cities}</strong> <span className="muted">{t("profile.cities")}</span>
            </div>
            <div>
              <strong>{people.length}</strong> <span className="muted">{t("profile.people")}</span>
            </div>
          </div>

          <div className="ig-name">{user.name}</div>
          <div className="ig-bio">{user.bio}</div>
        </div>
      </div>

      {editing && (
        <form className="experience-form ig-edit-form" onSubmit={saveProfile}>
          <label>
            {t("profile.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t("profile.username")}
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            {t("profile.bio")}
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} />
          </label>
          <fieldset>
            <legend>{t("profile.privacyLegend")}</legend>
            <div className="privacy-toggle">
              <button
                type="button"
                className={`chip ${!isPrivate ? "chip-active" : ""}`}
                onClick={() => setIsPrivate(false)}
              >
                {t("profile.public")}
              </button>
              <button
                type="button"
                className={`chip ${isPrivate ? "chip-active" : ""}`}
                onClick={() => setIsPrivate(true)}
              >
                {t("profile.private")}
              </button>
            </div>
            <p className="muted">
              {isPrivate
                ? t("profile.privateHint")
                : t("profile.publicHint")}
            </p>
          </fieldset>
          <ModerationNotice text={profileText} />
          <button
            type="submit"
            className="btn-primary"
            disabled={!isPublishable(profileText)}
          >
            {t("common.save")}
          </button>
        </form>
      )}

      {insights.length > 0 && (
        <>
          <div className="insights-head">
            <h2 className="timeline-title">{t("profile.insights")}</h2>
            <Link to="/retrospectiva" className="btn-outline">
              {t("profile.yearRetrospective")}
            </Link>
          </div>
          <div className="insights-list">
            {insights.map((i) => (
              <div key={i.id} className="insight-card">
                {i.text}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Where you have been, on the profile — the screen you open to look
          back, not the one you open to do something. */}
      <MemoryMap />

      <h2 className="timeline-title">Publicações</h2>
      <div className="ig-grid">
        {sortedExperiences.length === 0 && (
          <p className="muted">Nenhuma experiência publicada ainda.</p>
        )}
        {sortedExperiences.map((exp) => (
          <Link
            to={`/experience/${exp.id}`}
            key={exp.id}
            className="ig-tile"
            style={{ borderTopColor: categoryColor[exp.category] }}
          >
            <span className="ig-tile-label">{exp.category}</span>
          </Link>
        ))}
      </div>

      {/* No traveller plan, on purpose: nothing monthly, and the fee only
          exists on a booking they chose to make. */}
      <h2 className="timeline-title">{t("profile.whatYouPay")}</h2>
      <p className="muted">{t("profile.whatYouPayText", { pct: serviceFeePercent() })}</p>

      <h2 className="timeline-title">{t("profile.collections")}</h2>
      <div className="collections-grid">
        {collections.map((c) => {
          const pct = Math.min(100, Math.round((c.achieved / c.total) * 100));
          return (
            <div key={c.id} className="collection-card">
              <div className="collection-top">
                <span className="muted">
                  {c.achieved}/{c.total}
                </span>
              </div>
              <div className="collection-title">{t(c.titleKey)}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="muted">{pct}% concluído</div>
            </div>
          );
        })}
      </div>

      <h2 className="timeline-title">Pessoas</h2>
      <div className="people-grid">
        {people.map((p) => (
          <Link key={p.id} to={`/person/${p.id}`} className="person-card">
            <div className="avatar" style={{ background: p.avatarColor }}>
              {p.name[0]}
            </div>
            <div>{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
