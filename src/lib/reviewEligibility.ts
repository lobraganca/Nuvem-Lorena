import type { Booking } from "../types";
import { effectiveStatus } from "./bookingStatus";

/**
 * Who is allowed to review.
 *
 * Only someone who actually took the tour, bought through Avena, and whose
 * payment cleared. That single rule is what separates these reviews from the
 * ones anyone can write anywhere: a rating here always has a paid booking and
 * a date behind it.
 *
 * It lives here rather than inside a screen because it decides what gets
 * published. A condition written into JSX drifts the first time someone adds a
 * second place to review from.
 */

export type ReviewBlockReason =
  | "nao-pagou"
  | "cancelada"
  | "expirada"
  | "ainda-nao-foi"
  | "ja-avaliou";

export type ReviewEligibility =
  | { allowed: true }
  | { allowed: false; reason: ReviewBlockReason };

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function reviewEligibility(
  booking: Booking,
  now: Date = new Date()
): ReviewEligibility {
  const status = effectiveStatus(booking, now);

  if (status === "cancelada") return { allowed: false, reason: "cancelada" };
  if (status === "expirada") return { allowed: false, reason: "expirada" };
  if (status !== "confirmada") return { allowed: false, reason: "nao-pagou" };

  // The tour has to have happened. A review written the week before says
  // nothing about how the day went.
  if (booking.travelDate >= todayIso(now)) {
    return { allowed: false, reason: "ainda-nao-foi" };
  }

  if (booking.reviewed) return { allowed: false, reason: "ja-avaliou" };

  return { allowed: true };
}

export function canReview(booking: Booking, now: Date = new Date()): boolean {
  return reviewEligibility(booking, now).allowed;
}

export const reviewBlockKey = {
  "nao-pagou": "review.blockedNotPaid",
  cancelada: "review.blockedCancelled",
  expirada: "review.blockedExpired",
  "ainda-nao-foi": "review.blockedNotYet",
  "ja-avaliou": "review.alreadyDone",
} as const;
