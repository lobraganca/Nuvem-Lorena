import type { Business } from "../types";

/**
 * "Is this agency around right now?"
 *
 * Derived from the last time the agency actually used the app, never stored as
 * a status someone could leave switched on. An "online" light that lies is
 * worse than no light: the traveller writes expecting an answer within minutes
 * and gets silence.
 *
 * Real presence needs a server — a browser cannot know that another person's
 * tab is open. Until then this reflects the last visit recorded on this device,
 * which is honest about what it measures.
 */

export type PresenceStatus = "online" | "recente" | "hoje" | "ausente";

const ONLINE_MINUTES = 5;
const RECENT_MINUTES = 60;

export interface Presence {
  status: PresenceStatus;
  /** Minutes since the last activity, for the "seen X ago" wording. */
  minutesAgo: number;
}

export function presenceFor(business: Business, now: Date = new Date()): Presence {
  if (!business.lastSeenAt) return { status: "ausente", minutesAgo: Infinity };

  const minutesAgo = Math.max(
    0,
    Math.floor((now.getTime() - new Date(business.lastSeenAt).getTime()) / 60000)
  );

  if (minutesAgo <= ONLINE_MINUTES) return { status: "online", minutesAgo };
  if (minutesAgo <= RECENT_MINUTES) return { status: "recente", minutesAgo };
  if (minutesAgo <= 60 * 24) return { status: "hoje", minutesAgo };
  return { status: "ausente", minutesAgo };
}

/** Translation key and value for the label next to the dot. */
export function presenceLabel(presence: Presence): {
  key: "presence.online" | "presence.recent" | "presence.today" | "presence.away";
  vars?: Record<string, number>;
} {
  switch (presence.status) {
    case "online":
      return { key: "presence.online" };
    case "recente":
      return { key: "presence.recent", vars: { minutes: presence.minutesAgo } };
    case "hoje":
      return { key: "presence.today", vars: { hours: Math.floor(presence.minutesAgo / 60) } };
    default:
      return { key: "presence.away" };
  }
}
