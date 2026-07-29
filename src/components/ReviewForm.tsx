import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import type { Booking } from "../types";
import { ModerationNotice, isPublishable } from "./ModerationNotice";
import { useT } from "../i18n";
import { reviewBlockKey, reviewEligibility } from "../lib/reviewEligibility";
import { newId } from "../lib/ids";

export function ReviewForm({ booking }: { booking: Booking }) {
  const { addReview, user } = useAvena();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [recommends, setRecommends] = useState(true);
  const [done, setDone] = useState(false);
  const t = useT();

  const eligibility = reviewEligibility(booking);

  if (done || booking.reviewed) {
    return <div className="muted">{t("review.alreadyDone")}</div>;
  }

  if (!eligibility.allowed) {
    return <div className="muted">{t(reviewBlockKey[eligibility.reason])}</div>;
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        {t("review.rate")}
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPublishable(comment) || !eligibility.allowed) return;
    addReview({
      id: newId(),
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
        placeholder={t("review.placeholder")}
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
          {t("review.recommend")}
        </button>
        <button
          type="button"
          className={`chip ${!recommends ? "chip-active" : ""}`}
          onClick={() => setRecommends(false)}
        >
          {t("review.dontRecommend")}
        </button>
      </div>
      <div className="chip-row">
        <button
          type="submit"
          className="btn-primary"
          disabled={!isPublishable(comment)}
        >
          {t("review.send")}
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
