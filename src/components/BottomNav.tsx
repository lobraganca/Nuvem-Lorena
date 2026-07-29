import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useT } from "../i18n";

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
const personIcon = icon("M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.7-9 6v2h18v-2c0-3.3-4-6-9-6z");
const peopleIcon = icon("M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1c0-3 3-5 6-5s6 2 6 5v1H2zm14 0v-1c0-1.5-.6-2.8-1.5-3.8 3 .3 5.5 2 5.5 4.3V20h-4z");
const dashboardIcon = icon("M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z");

/**
 * Fixed tab bar for phones. A travel app is used standing up, one-handed, so
 * the main destinations cannot live in a strip that scrolls sideways.
 */
export function BottomNav() {
  const { user } = useAvena();
  const t = useT();

  if (!user.accountType) return null;

  const items: Item[] =
    user.accountType === "profissional"
      ? [
          { to: "/professional", label: t("nav.dashboard"), icon: dashboardIcon },
          { to: "/destination", label: t("nav.search"), icon: searchIcon },
          { to: "/messages", label: t("nav.messages"), icon: ticketIcon },
          { to: "/profile", label: t("nav.profile"), icon: personIcon },
        ]
      : [
          { to: "/", label: t("nav.map"), icon: mapIcon },
          { to: "/destination", label: t("nav.search"), icon: searchIcon },
          { to: "/feed", label: t("nav.feed"), icon: peopleIcon },
          { to: "/bookings", label: t("nav.bookings"), icon: ticketIcon },
          { to: "/profile", label: t("nav.profile"), icon: personIcon },
        ];

  return (
    <nav className="bottom-nav" aria-label={t("nav.main")}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? "bottom-nav-item-active" : ""}`
          }
        >
          <span className="bottom-nav-icon-wrap">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
