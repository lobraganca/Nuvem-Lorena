import type { Booking, Tour } from "../types";
import { holdsSeat } from "./bookingStatus";

export interface AvailabilityInfo {
  tracked: boolean;
  capacity?: number;
  booked: number;
  remaining: number;
}

export function availabilityFor(
  tour: Tour,
  bookings: Booking[],
  date: string
): AvailabilityInfo {
  if (tour.capacityPerDay === undefined) {
    return { tracked: false, booked: 0, remaining: Infinity };
  }

  // A seat being paid for is as unavailable as one already paid, otherwise two
  // people could buy the last place at the same time.
  const booked = bookings
    .filter((b) => b.tourId === tour.id && b.travelDate === date && holdsSeat(b))
    .reduce((sum, b) => sum + b.travelers, 0);

  return {
    tracked: true,
    capacity: tour.capacityPerDay,
    booked,
    remaining: Math.max(0, tour.capacityPerDay - booked),
  };
}
