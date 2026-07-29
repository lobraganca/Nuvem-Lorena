import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { readStored, writeStored } from "../lib/safeStorage";
import { useT } from "../i18n";

const DISMISSED_KEY = "avena-app-offer-dismissed";

/** Below this many memories, there is nothing yet worth carrying anywhere. */
const ENOUGH_TO_CARE = 2;

/**
 * The invitation to install, offered late on purpose.
 *
 * Nobody installs an app because the navigation is smooth; they install it once
 * something of theirs is inside it. Asking on the first screen is asking for a
 * commitment before there is a reason for one — so this waits until the map has
 * a couple of places on it, and takes no for an answer.
 */
export function AppOffer() {
  const { experiences } = useAvena();
  const t = useT();
  const [dismissed, setDismissed] = useState(() => readStored(DISMISSED_KEY) === "1");

  if (dismissed || experiences.length < ENOUGH_TO_CARE) return null;

  return (
    <section className="app-offer">
      <div>
        <h2 className="timeline-title">{t("app.offerTitle")}</h2>
        <p className="muted">{t("app.offerText", { count: experiences.length })}</p>
      </div>
      <div className="chip-row">
        <Link to="/app" className="btn-primary">
          {t("app.offerButton")}
        </Link>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            writeStored(DISMISSED_KEY, "1");
            setDismissed(true);
          }}
        >
          {t("app.offerDismiss")}
        </button>
      </div>
    </section>
  );
}
