/**
 * Renting a place, as opposed to selling a seat.
 *
 * A tour is bought per person for one day; a house is rented per night, and
 * the number of people does not change the price — it only has to fit. The two
 * live side by side in the same app, so everything that differs between them
 * is gathered here rather than spread through the screens as `if`s.
 */
import type { Tour } from "../types";

/** True when this listing is a place to stay, priced per night. */
export function isStay(tour: Tour): boolean {
  return tour.pricingUnit === "diaria";
}

/** Nights between two dates. Zero or negative means the dates are wrong. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00`);
  const b = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** The first thing wrong with a stay, in reading order, or null. */
export function stayProblem(
  tour: Tour,
  checkIn: string,
  checkOut: string,
  guests: number
): string | null {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) return "A saída precisa ser depois da entrada.";
  const min = tour.minNights ?? 1;
  if (nights < min)
    return `A estadia mínima é de ${min} ${min === 1 ? "noite" : "noites"}.`;
  if (tour.maxGuests && guests > tour.maxGuests)
    return `Este lugar acomoda até ${tour.maxGuests} ${
      tour.maxGuests === 1 ? "pessoa" : "pessoas"
    }.`;
  return null;
}

/** The date after a given one, used as the default check-out. */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
