import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { unreadCount } from "../lib/messages";
import { useT } from "../i18n";

interface Item {
  to: string;
  label: string;
  /** Drawn inline so the bar needs no icon font and no network request. */
  icon: ReactElement;
  /** Number on the corner of the icon, hidden when zero. */
  badge?: number;
}

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="bottom-nav-icon">
    <path d={path} />
  </svg>
);

const heartIcon = icon("M12 20.7 4.3 13a5 5 0 0 1 7.1-7l.6.6.6-.6a5 5 0 1 1 7.1 7L12 20.7z");
const searchIcon = icon("M10.5 3a7.5 7.5 0 1 1-4.7 13.3L3 19.1 1.9 18l2.8-2.8A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z");
const messageIcon = icon("M12 3c5 0 9 3.4 9 7.7 0 4.2-4 7.6-9 7.6-1 0-2-.1-2.9-.4L4 20.5l1.2-3.4C3.2 15.7 3 13.3 3 10.7 3 6.4 7 3 12 3z");
const ticketIcon = icon("M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z");
const dashboardIcon = icon("M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z");

/**
 * Floating tab bar for phones, in the shape people already know from social
 * apps: the five places you actually go, and nothing else. A travel app is used
 * standing up and one-handed, so these cannot live in a strip that scrolls.
 */
export function BottomNav() {
  const { user, messages } = useAvena();
  const t = useT();

  // No gate here any more. It used to hide until an account type was chosen,
  // which is what made the first-trip question a wall: no tabs, no way out.
  // This only renders inside the app shell, which already requires the door.

  const unread = unreadCount(messages, user.threadReads);

  /** The person's own face is the profile tab, as in every app of this shape. */
  const avatarTab = (
    <span
      className="bottom-nav-avatar"
      style={
        user.avatarPhoto
          ? { backgroundImage: `url(${user.avatarPhoto})` }
          : { background: user.avatarColor }
      }
      aria-hidden="true"
    >
      {!user.avatarPhoto && (user.name?.[0] ?? "?")}
    </span>
  );

  const items: Item[] =
    user.accountType === "profissional"
      ? [
          { to: "/professional", label: t("nav.dashboard"), icon: dashboardIcon },
          { to: "/destination", label: t("nav.search"), icon: searchIcon },
          { to: "/messages", label: t("nav.messages"), icon: messageIcon, badge: unread },
          { to: "/profile", label: t("nav.profile"), icon: avatarTab },
        ]
      : [
          // Four, not five. Messages moved to the top bar, where the icon can
          // carry the same unread count without spending a whole tab on a
          // screen most people open once a week.
          // Five, labelled, the shape of every app people already use.
          { to: "/", label: t("nav.explore"), icon: searchIcon },
          { to: "/desejos", label: t("nav.favourites"), icon: heartIcon },
          { to: "/bookings", label: t("nav.trips"), icon: ticketIcon },
          { to: "/messages", label: t("nav.messages"), icon: messageIcon, badge: unread },
          { to: "/profile", label: t("nav.profile"), icon: avatarTab },
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
          <span className="bottom-nav-icon-wrap">
            {item.icon}
            {item.badge ? (
              <span className="nav-badge">{item.badge > 9 ? "9+" : item.badge}</span>
            ) : null}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
          {item.badge ? (
            <span className="sr-only">{t("nav.unread", { count: item.badge })}</span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
