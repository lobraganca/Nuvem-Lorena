import { useRef, useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { useAuth } from "../store/AuthContext";
import { fileToStoredPhoto } from "../lib/photos";
import { serviceFeePercent } from "../lib/pricing";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { SettingsRow, rowIcon } from "../components/SettingsRow";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { openCookiePreferences } from "../components/CookieBanner";
import { partnerSignupUrl } from "../lib/partnerSite";
import { formatPhone } from "../lib/documents";
import { useT } from "../i18n";

/**
 * The profile: who you are, and everything about the account.
 *
 * It used to be this and the travelling as well — the map, the memories, the
 * collections, the plan cards — six sections deep, which made the one thing
 * people open a profile for hardest to find. The travelling moved to Viagens.
 * What is left reads as rows, the shape every app of this kind uses, because
 * a list of settings is scanned rather than read.
 */
export function Profile() {
  const { user, updateUser } = useAvena();
  const { account, signOut, askForPhone } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  // Inside the installed app this leaves for the website, so the store takes
  // no cut of what a partner pays to join.
  const partnerUrl = partnerSignupUrl();

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToStoredPhoto(file)
      .then((photo) => updateUser({ avatarPhoto: photo }))
      .catch(() => alert("Não foi possível usar esta imagem. Tente outra foto."));
  }

  /** +5511999998888 back into the shape a Brazilian reads. */
  function readablePhone(stored: string) {
    return `+55 ${formatPhone(stored.replace(/^\+55/, ""))}`;
  }

  const profileText = `${name} ${username} ${bio}`;

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isPublishable(profileText)) return;
    updateUser({ name, username, bio, isPrivate });
    setEditing(false);
  }

  return (
    <div className="page profile-page">
      <div className="profile-card">
        <button
          type="button"
          className="profile-avatar-btn"
          onClick={() => fileInputRef.current?.click()}
          title={t("profile.changePhoto")}
        >
          {user.avatarPhoto ? (
            <img src={user.avatarPhoto} alt={user.name} className="profile-avatar" />
          ) : (
            <span
              className="profile-avatar profile-avatar-fallback"
              style={{ background: user.avatarColor }}
            >
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handlePhotoChange}
        />
        <h1>{user.name}</h1>
        {account && <p className="muted">{account.email}</p>}
      </div>

      {user.accountType === "profissional" ? (
        <div className="settings-group-rows">
          <SettingsRow to="/professional" icon={rowIcon.store} label={t("profile.goToDashboard")} />
        </div>
      ) : (
        <div className="settings-group-rows">
          <SettingsRow
            to={partnerUrl ? undefined : "/business"}
            href={partnerUrl ?? undefined}
            icon={rowIcon.store}
            label={t("profile.announce")}
          />
        </div>
      )}

      <div className="settings-group-rows">
        <SettingsRow
          onClick={() => setEditing((v) => !v)}
          icon={rowIcon.person}
          label={t(editing ? "common.cancel" : "profile.editProfile")}
        />
        <SettingsRow to="/meus-dados" icon={rowIcon.person} label={t("profile.myData")} />
        {account && (
          <div className="settings-row settings-row-static">
            <span className="row-icon" aria-hidden="true">
              {rowIcon.phone}
            </span>
            <span className="row-label">{t("profile.phone")}</span>
            <span className="muted">
              {account.phone ? readablePhone(account.phone) : "—"}
            </span>
          </div>
        )}
        {account && !account.phone && (
          <SettingsRow
            onClick={askForPhone}
            icon={rowIcon.phone}
            label={t("profile.phoneConfirm")}
          />
        )}
        <SettingsRow to="/desejos" icon={rowIcon.star} label={t("nav.wishlist")} />
        <SettingsRow to="/feed" icon={rowIcon.map} label={t("nav.people")} />
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
              {isPrivate ? t("profile.privateHint") : t("profile.publicHint")}
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

      <h2 className="settings-section">{t("settings.payments")}</h2>
      <div className="settings-group-rows">
        <div className="settings-note">
          {t("profile.whatYouPayText", { pct: serviceFeePercent() })}
        </div>
      </div>

      <h2 className="settings-section">{t("settings.app")}</h2>
      <div className="settings-group-rows">
        <div className="settings-row settings-row-static">
          <span className="row-icon" aria-hidden="true">
            {rowIcon.phone}
          </span>
          <span className="row-label">{t("language.title")}</span>
          <LanguageSwitcher />
        </div>
        <SettingsRow to="/app" icon={rowIcon.phone} label={t("app.navLink")} />
        <SettingsRow to="/ajuda" icon={rowIcon.help} label={t("footer.help")} />
        <SettingsRow
          onClick={openCookiePreferences}
          icon={rowIcon.shield}
          label={t("footer.cookies")}
        />
      </div>

      <h2 className="settings-section">{t("settings.legal")}</h2>
      <div className="settings-group-rows">
        <SettingsRow to="/termos" icon={rowIcon.shield} label={t("footer.terms")} />
        <SettingsRow to="/privacidade" icon={rowIcon.lock} label={t("footer.privacy")} />
      </div>

      {account && (
        <div className="settings-group-rows">
          <SettingsRow onClick={signOut} icon={rowIcon.exit} label={t("auth.signOut")} danger />
        </div>
      )}

      {/* So "it did not change" can be checked instead of guessed: this is the
          build the phone is actually running. */}
      <p className="muted build-id">Versão {__BUILD_ID__}</p>
    </div>
  );
}
