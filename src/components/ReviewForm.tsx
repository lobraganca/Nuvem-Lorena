import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import type { Booking } from "../types";
import { ModerationNotice, isPublishable } from "./ModerationNotice";

export function ReviewForm({ booking }: { booking: Booking }) {
  const { addReview, user } = useAvena();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [recommends, setRecommends] = useState(true);
  const [done, setDone] = useState(false);

  if (booking.reviewed || done) {
    return <div className="muted">Você já avaliou esta agência.</div>;
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Avaliar agência
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPublishable(comment)) return;
    addReview({
      id: crypto.randomUUID(),
      businessId: booking.businessId,
      bookingId: booking.id,
      tourTitle: booking.tourTitle,
      rating,
      comment,
      recommends,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    });
    setDone(true);
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="star-picker">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            className={`star-btn ${n <= rating ? "star-btn-active" : ""}`}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Como foi o passeio? Conte para outros viajantes."
        rows={2}
        required
      />
      <ModerationNotice text={comment} />
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${recommends ? "chip-active" : ""}`}
          onClick={() => setRecommends(true)}
        >
          Recomendo
        </button>
        <button
          type="button"
          className={`chip ${!recommends ? "chip-active" : ""}`}
          onClick={() => setRecommends(false)}
        >
          Não recomendo
        </button>
      </div>
      <div className="chip-row">
        <button
          type="submit"
          className="btn-primary"
          disabled={!isPublishable(comment)}
        >
          Enviar avaliação
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
