import { presenceFor, presenceLabel } from "../lib/presence";
import { useT } from "../i18n";
import type { Business } from "../types";

/**
 * Green dot next to an agency that is using the app right now.
 *
 * Nothing is shown when the agency has been away for more than a day: an
 * absence label on every listing would just add noise, and "last seen 3 weeks
 * ago" reads as an accusation.
 */
export function PresenceDot({
  business,
  showLabel = true,
}: {
  business: Business;
  showLabel?: boolean;
}) {
  const t = useT();
  const presence = presenceFor(business);
  if (presence.status === "ausente") return null;

  const { key, vars } = presenceLabel(presence);
  const label = t(key, vars);

  return (
    <span className={`presence presence-${presence.status}`}>
      <span className="presence-dot" aria-hidden="true" />
      {showLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}
