import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useNotifications } from "../hooks/useNotifications";

interface Item {
  to: string;
  label: string;
  /** Drawn inline so the bar needs no icon font and no network request. */
  icon: ReactElement;
}

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="bottom-nav-icon">
    <path d={path} />
  </svg>
);

const mapIcon = icon("M9 3 3 5.5v16L9 19l6 2.5 6-2.5v-16L15 5.5 9 3zm0 2.2 6 2.5v11.1l-6-2.5V5.2z");
const searchIcon = icon("M10.5 3a7.5 7.5 0 1 1-4.7 13.3L3 19.1 1.9 18l2.8-2.8A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z");
const ticketIcon = icon("M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z");
const bellIcon = icon("M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z");
const personIcon = icon("M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.7-9 6v2h18v-2c0-3.3-4-6-9-6z");
const dashboardIcon = icon("M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z");

/**
 * Fixed tab bar for phones. A travel app is used standing up, one-handed, so
 * the main destinations cannot live in a strip that scrolls sideways.
 */
export function BottomNav() {
  const { user } = useAvena();
  const notifications = useNotifications();

  if (!user.accountType) return null;

  const items: Item[] =
    user.accountType === "profissional"
      ? [
          { to: "/professional", label: "Painel", icon: dashboardIcon },
          { to: "/destination", label: "Buscar", icon: searchIcon },
          { to: "/messages", label: "Mensagens", icon: ticketIcon },
          { to: "/profile", label: "Perfil", icon: personIcon },
        ]
      : [
          { to: "/", label: "Mapa", icon: mapIcon },
          { to: "/destination", label: "Buscar", icon: searchIcon },
          { to: "/bookings", label: "Reservas", icon: ticketIcon },
          { to: "/notifications", label: "Avisos", icon: bellIcon },
          { to: "/profile", label: "Perfil", icon: personIcon },
        ];

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? "bottom-nav-item-active" : ""}`
          }
        >
          <span className="bottom-nav-icon-wrap">
            {item.icon}
            {item.to === "/notifications" && notifications.length > 0 && (
              <span className="nav-badge" aria-hidden="true">
                {notifications.length}
              </span>
            )}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
          {item.to === "/notifications" && notifications.length > 0 && (
            <span className="sr-only">
              {notifications.length} notificações não lidas
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
