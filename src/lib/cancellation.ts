import type { Booking, CancellationPolicy } from "../types";

export const cancellationPolicies: CancellationPolicy[] = ["flexivel", "moderada", "rigida"];

export const cancellationPolicyLabel: Record<CancellationPolicy, string> = {
  flexivel: "Flexível",
  moderada: "Moderada",
  rigida: "Rígida",
};

export const cancellationPolicyDescription: Record<CancellationPolicy, string> = {
  flexivel: "Reembolso total até 24h antes do passeio.",
  moderada: "Reembolso total até 3 dias antes; depois disso, 50% de reembolso.",
  rigida: "Reembolso total até 7 dias antes; depois disso, sem reembolso.",
};

/** Translation keys for the screens a traveller sees in any language. */
export const cancellationLabelKey = {
  flexivel: "cancel.flexivel",
  moderada: "cancel.moderada",
  rigida: "cancel.rigida",
} as const;

export const cancellationDescriptionKey = {
  flexivel: "cancel.flexivelText",
  moderada: "cancel.moderadaText",
  rigida: "cancel.rigidaText",
} as const;

const MIN_DAYS_FOR_FULL_REFUND: Record<CancellationPolicy, number> = {
  flexivel: 1,
  moderada: 3,
  rigida: 7,
};

export function daysUntil(dateIso: string): number {
  const ms = new Date(dateIso).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function computeRefund(booking: Booking): {
  refundAmount: number;
  refundPct: number;
} {
  const days = daysUntil(booking.travelDate);
  const minDays = MIN_DAYS_FOR_FULL_REFUND[booking.cancellationPolicy];

  let refundPct: number;
  if (days >= minDays) {
    refundPct = 100;
  } else if (booking.cancellationPolicy === "moderada" && days >= 0) {
    refundPct = 50;
  } else if (booking.cancellationPolicy === "flexivel" && days >= 0) {
    refundPct = 50;
  } else {
    refundPct = 0;
  }

  const refundAmount = Math.round(booking.totalPrice * (refundPct / 100) * 100) / 100;
  return { refundAmount, refundPct };
}


/**
 * Até quando dá para cancelar sem perder nada, como data.
 *
 * "Reembolso total até 3 dias antes" obriga a pessoa a fazer a conta na
 * cabeça, e ela faz errado. "Cancelamento grátis até 12 de setembro" é a
 * mesma regra dita de um jeito que se decide em cima.
 */
export function freeCancellationUntil(
  travelDate: string,
  policy: CancellationPolicy
): string | null {
  const dias = policy === "flexivel" ? 1 : policy === "moderada" ? 3 : null;
  if (dias === null) return null;
  const [y, m, d] = travelDate.split("-").map(Number);
  const data = new Date(y, m - 1, d, 12);
  data.setDate(data.getDate() - dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate()
  ).padStart(2, "0")}`;
}
