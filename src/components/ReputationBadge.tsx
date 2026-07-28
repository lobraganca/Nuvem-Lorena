import { reputationLabel } from "../lib/reviews";

export function ReputationBadge({
  avgRating,
  count,
}: {
  avgRating: number;
  count: number;
}) {
  if (count === 0) {
    return <span className="reputation-badge reputation-empty">Sem avaliações ainda</span>;
  }

  return (
    <span className="reputation-badge">
      <span className="reputation-score">{avgRating.toFixed(1)}</span>
      <span className="reputation-label">{reputationLabel(avgRating)}</span>
      <span className="muted">
        ({count} {count === 1 ? "avaliação" : "avaliações"})
      </span>
    </span>
  );
}
