import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { unreadCount } from "../lib/messages";
import { useT } from "../i18n";

/**
 * Messages in the top bar rather than in the tab bar.
 *
 * Conversations matter, but they are not where a traveller goes several times a
 * day, and a tab is the most expensive place in the app. The icon keeps the
 * same unread count it had as a tab.
 */
export function MessagesBell() {
  const { messages, user } = useAvena();
  const t = useT();
  const unread = unreadCount(messages, user.threadReads);

  return (
    <Link to="/messages" className="nav-notifications" aria-label={t("nav.messages")}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="topbar-icon">
        <path
          fill="currentColor"
          d="M12 3c5 0 9 3.4 9 7.7 0 4.2-4 7.6-9 7.6-1 0-2-.1-2.9-.4L4 20.5l1.2-3.4C3.2 15.7 3 13.3 3 10.7 3 6.4 7 3 12 3z"
        />
      </svg>
      {unread > 0 && (
        <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>
      )}
    </Link>
  );
}
