import type { Booking, BookingStatus } from "../types";

/** How long a seat is held while the traveller completes the payment. */
export const PAYMENT_WINDOW_MINUTES = 30;

export function paymentDeadline(from: Date = new Date()): string {
  return new Date(from.getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000).toISOString();
}

/**
 * The stored status plus the passage of time.
 *
 * An unpaid booking whose window has closed is expired, even though nothing
 * wrote that to storage — derived so it is always right, including for someone
 * who left the app open overnight.
 */
export function effectiveStatus(booking: Booking, now: Date = new Date()): BookingStatus {
  if (
    booking.status === "aguardando-pagamento" &&
    booking.paymentDueAt &&
    new Date(booking.paymentDueAt) < now
  ) {
    return "expirada";
  }
  return booking.status;
}

/** A seat is occupied while it is paid for, or while it is being paid for. */
export function holdsSeat(booking: Booking, now: Date = new Date()): boolean {
  const status = effectiveStatus(booking, now);
  return status === "confirmada" || status === "aguardando-pagamento";
}

export const bookingStatusLabel: Record<BookingStatus, string> = {
  "aguardando-pagamento": "Aguardando pagamento",
  confirmada: "Confirmada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

export const bookingStatusHint: Record<BookingStatus, string> = {
  "aguardando-pagamento":
    "A vaga está reservada para você, mas só é confirmada com o pagamento.",
  confirmada: "Pagamento aprovado. A agência recebeu sua lista de participantes.",
  expirada: "O prazo de pagamento passou e a vaga voltou para o passeio.",
  cancelada: "Reserva cancelada.",
};

export function minutesLeftToPay(booking: Booking, now: Date = new Date()): number {
  if (!booking.paymentDueAt) return 0;
  const diff = new Date(booking.paymentDueAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 60000));
}
