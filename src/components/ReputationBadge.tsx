import { reputationFor } from "../lib/reviews";
import { useT } from "../i18n";

export function ReputationBadge({
  avgRating,
  count,
}: {
  avgRating: number;
  count: number;
}) {
  const t = useT();
  const reputation = reputationFor(avgRating, count);

  if (count === 0) {
    return (
      <span className="reputation-badge reputation-empty">{t("reputation.none")}</span>
    );
  }

  return (
    <span className="reputation-badge">
      <span className="reputation-score">{avgRating.toFixed(1)}</span>
      <span
        className={`reputation-label ${reputation.provisional ? "reputation-provisional" : ""}`}
      >
        {t(reputation.labelKey)}
      </span>
      <span className="muted">
        ({count} {t(count === 1 ? "common.review" : "common.reviews")})
      </span>
    </span>
  );
}
