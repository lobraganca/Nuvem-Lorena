import { isStoreLive, storeUrl, type StoreName } from "../lib/appStores";
import { useT } from "../i18n";

/**
 * The Apple mark and the Google Play triangle, drawn inline.
 *
 * Inline rather than image files on purpose: the badges have to work offline,
 * inside the single-file build and on a dark background, and an <img> would
 * bring none of that.
 */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="store-badge-mark">
      <path
        fill="currentColor"
        d="M17.05 12.04c-.03-2.7 2.2-4 2.3-4.06-1.25-1.83-3.2-2.08-3.9-2.11-1.66-.17-3.24.98-4.08.98-.84 0-2.14-.96-3.52-.93-1.81.03-3.48 1.05-4.41 2.67-1.88 3.27-.48 8.11 1.35 10.77.9 1.3 1.97 2.76 3.38 2.71 1.36-.06 1.87-.88 3.51-.88s2.1.88 3.53.85c1.46-.02 2.38-1.32 3.27-2.63 1.03-1.5 1.46-2.96 1.48-3.04-.03-.01-2.84-1.09-2.87-4.33zM14.5 4.5c.74-.9 1.24-2.15 1.1-3.4-1.07.04-2.36.71-3.13 1.61-.68.79-1.28 2.06-1.12 3.28 1.19.09 2.41-.6 3.15-1.49z"
      />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="store-badge-mark">
      <path fill="#00d3ff" d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l.1.1 9.2-9.2v-.2L3.6 2.4z" />
      <path fill="#ffce00" d="M15.9 15.6l-3-3v-.2l3-3 .1.1 3.6 2.1c1 .6 1 1.6 0 2.2l-3.7 1.8z" />
      <path fill="#ff3a44" d="M16 15.5l-3.1-3.1-9.3 9.3c.3.4.9.4 1.5.1l10.9-6.3z" />
      <path fill="#00c853" d="M16 8.9L5.1 2.7c-.6-.4-1.2-.3-1.5.1l9.3 9.3L16 8.9z" />
    </svg>
  );
}

/**
 * One store badge. It is a link once the app is published there, and a plain
 * "coming soon" block until then — never a link that leads nowhere.
 */
export function StoreBadge({ store }: { store: StoreName }) {
  const t = useT();
  const live = isStoreLive(store);
  const mark = store === "apple" ? <AppleMark /> : <PlayMark />;
  const top = live
    ? t(store === "apple" ? "app.appleTop" : "app.playTop")
    : t("app.comingSoon");
  const name = store === "apple" ? "App Store" : "Google Play";

  const inside = (
    <>
      {mark}
      <span className="store-badge-text">
        <span className="store-badge-top">{top}</span>
        <span className="store-badge-name">{name}</span>
      </span>
    </>
  );

  if (!live) {
    return (
      <span className="store-badge store-badge-soon" aria-disabled="true">
        {inside}
      </span>
    );
  }

  return (
    <a
      className="store-badge"
      href={storeUrl(store)}
      target="_blank"
      rel="noreferrer"
      aria-label={t("app.downloadOn", { store: name })}
    >
      {inside}
    </a>
  );
}

export function StoreBadges() {
  return (
    <div className="store-badges">
      <StoreBadge store="play" />
      <StoreBadge store="apple" />
    </div>
  );
}
