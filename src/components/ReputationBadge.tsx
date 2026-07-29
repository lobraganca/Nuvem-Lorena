import { reputationFor } from "../lib/reviews";

export function ReputationBadge({
  avgRating,
  count,
}: {
  avgRating: number;
  count: number;
}) {
  const reputation = reputationFor(avgRating, count);

  if (count === 0) {
    return <span className="reputation-badge reputation-empty">Sem avaliações ainda</span>;
  }

  return (
    <span className="reputation-badge">
      <span className="reputation-score">{avgRating.toFixed(1)}</span>
      <span
        className={`reputation-label ${reputation.provisional ? "reputation-provisional" : ""}`}
      >
        {reputation.label}
      </span>
      <span className="muted">
        ({count} {count === 1 ? "avaliação" : "avaliações"})
      </span>
    </span>
  );
}
