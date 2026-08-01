import { Link } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import { useAvena } from "../store/AvenaContext";
import { useT } from "../i18n";

/**
 * Lives in the top bar rather than the tab bar, so it stays reachable on a
 * phone where the tab bar is full.
 */
export function NotificationsBell() {
  const { user } = useAvena();
  const notifications = useNotifications();
  const t = useT();

  // O sino serve aos dois: o viajante recebe lembrete de passeio, a agência
  // recebe aviso de reserva. Antes ele sumia para quem recebe — justamente
  // quem tem algo a perder por não olhar.
  if (!user.accountType) return null;

  const count = notifications.length;

  return (
    <Link
      to="/notifications"
      className="bell-link"
      aria-label={
        count > 0
          ? `${t("nav.notifications")} (${count})`
          : t("nav.notifications")
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="bell-icon">
        <path d="M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z" />
      </svg>
      {count > 0 && (
        <span className="nav-badge" aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}
