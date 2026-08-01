/**
 * How Avena makes money, in one place.
 *
 * Two sources, and neither is a subscription — for the traveller or for the
 * business:
 *
 * 1. The traveller pays a service fee on top of each booking.
 * 2. A business can pay to promote a listing (see `boosts.ts`), which is
 *    optional and always labelled as sponsored.
 *
 * Joining costs the business nothing. That is Lorena's decision, and it is
 * also the only one that works at this size: a marketplace with no travellers
 * on it yet cannot charge an agency for entry — they would be buying a shop
 * with no street.
 *
 * This is the opposite of what the app did before, where the fee was deducted
 * from the agency's payout. Now the agency receives the full price it
 * advertised, and the fee is added to what the traveller pays — which is why
 * the booking screen shows it as its own line rather than burying it.
 *
 * The rate is Lorena's: 5% to start. Changing this number changes every quote
 * in the app, so it lives here and nowhere else.
 */
export const SERVICE_FEE_RATE = 0.05;

/**
 * What a business pays to join: nothing.
 *
 * Kept as a named constant rather than deleted, because the day this changes
 * it has to change in one place, and because a screen that wants to say "free"
 * should read it from here instead of hard-coding the word.
 */
export const JOINING_FEE = 0;

/** True while joining is free. */
export const LAUNCH_WAIVER = JOINING_FEE === 0;

export interface BookingTotals {
  /** The tour price times the number of travellers. */
  subtotal: number;
  /** Avena's fee, paid by the traveller on top of the subtotal. */
  fee: number;
  /** What the traveller actually pays. */
  total: number;
  /** What the business receives: the whole advertised price. */
  businessReceives: number;
}

/**
 * What the traveller pays.
 *
 * `quantity` is what the price is counted in: the number of people for a tour,
 * the number of nights for a house. A rental multiplied by the number of
 * guests instead of the nights is a bill several times too big, so the caller
 * has to say which — there is no sensible default that is safe for both.
 */
/** Ao centavo. Em ponto flutuante, 0,10 × 3 dá 0,30000000000000004. */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function bookingTotals(unitPrice: number, quantity: number): BookingTotals {
  // Arredondado aqui também, e não só na taxa: o subtotal entra no total, no
  // repasse e no reembolso, e um resto de centésimo que sobrevive a essas três
  // contas acaba aparecendo como "R$ 462,00000000000006" na tela de alguém.
  const subtotal = centavos(unitPrice * Math.max(1, quantity));
  const fee = centavos(subtotal * SERVICE_FEE_RATE);
  return {
    subtotal,
    fee,
    total: centavos(subtotal + fee),
    businessReceives: subtotal,
  };
}

export function serviceFeePercent(): number {
  return Math.round(SERVICE_FEE_RATE * 100);
}
