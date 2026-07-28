import { Link } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";

/**
 * Surfaces the most recent pending notification inline, so a finished tour
 * prompts the traveler even if they never open the notifications page.
 */
export function NotificationBanner() {
  const notifications = useNotifications();
  const latest = notifications[0];

  if (!latest) return null;

  return (
    <div className="notification-banner">
      <div className="notification-banner-text">
        <strong>{latest.title}</strong> — {latest.body}
      </div>
      <div className="chip-row">
        <Link to={latest.actionTo} className="btn-primary">
          {latest.actionLabel}
        </Link>
        {notifications.length > 1 && (
          <Link to="/notifications" className="btn-outline">
            Ver todas ({notifications.length})
          </Link>
        )}
      </div>
    </div>
  );
}
