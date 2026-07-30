/**
 * How Avena makes money, in one place.
 *
 * Two sources, and neither is a subscription for the traveller:
 *
 * 1. The business pays a joining fee to be on the platform (see `plans`).
 * 2. The traveller pays a service fee on top of each booking.
 *
 * This is the opposite of what the app did before, where the fee was deducted
 * from the agency's payout. Now the agency receives the full price it
 * advertised, and the fee is added to what the traveller pays — which is why
 * the booking screen shows it as its own line rather than burying it.
 *
 * The rate below is a placeholder until Lorena sets the real one. Changing this
 * number changes every quote in the app, so it lives here and nowhere else.
 */
export const SERVICE_FEE_RATE = 0.1;

/**
 * What a business pays to join, on top of whatever plan it picks.
 *
 * Zero during the launch, and that is a decision rather than an omission: a
 * two-sided marketplace with no travellers on it yet cannot ask an agency to
 * pay for entry — they would be buying a shop with no street. Once there is
 * real movement this becomes a real number, and the partners who came first
 * keep the waiver, which is the only fair way to treat the people who took the
 * risk of being early.
 */
export const JOINING_FEE = 0;

/** True while joining is free, so the page says so instead of showing "R$ 0". */
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

export function bookingTotals(unitPrice: number, travelers: number): BookingTotals {
  const subtotal = unitPrice * Math.max(1, travelers);
  // Rounded to the cent, so the three lines on screen always add up.
  const fee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  return {
    subtotal,
    fee,
    total: subtotal + fee,
    businessReceives: subtotal,
  };
}

export function serviceFeePercent(): number {
  return Math.round(SERVICE_FEE_RATE * 100);
}
