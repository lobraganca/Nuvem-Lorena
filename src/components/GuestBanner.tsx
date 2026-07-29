import { useAuth } from "../store/AuthContext";
import { useT } from "../i18n";

/**
 * Someone who came in without an account is told, on every screen, that
 * nothing they do will survive — the moment to learn that is before they
 * write a memory, not after.
 */
export function GuestBanner() {
  const { isGuest, signOut } = useAuth();
  const t = useT();

  if (!isGuest) return null;

  return (
    <div className="guest-banner" role="status">
      <span>{t("auth.guestBanner")}</span>
      <button type="button" className="footer-link" onClick={signOut}>
        {t("auth.guestCreate")}
      </button>
    </div>
  );
}
