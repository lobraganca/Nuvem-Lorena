import { moderate, moderationMessageKey } from "../lib/moderation";
import { useT } from "../i18n";

/**
 * Shown under a field while the text would be refused. It names the problem
 * without repeating the offending word, and says plainly that a bad review is
 * not the problem — so nobody softens honest criticism out of fear.
 */
export function ModerationNotice({ text }: { text: string }) {
  const t = useT();
  const key = moderationMessageKey(moderate(text));
  if (!key) return null;

  return (
    <p className="moderation-notice" role="alert">
      {t(key)} <span className="muted">{t("moderation.criticismIsFine")}</span>
    </p>
  );
}

/** True when the text may be published. */
export function isPublishable(text: string): boolean {
  return moderate(text).severity === "ok";
}
