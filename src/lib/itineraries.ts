import type { Experience } from "../types";

export interface ItineraryStop {
  locationName: string;
  category: Experience["category"];
  timesVisited: number;
}

export interface Itinerary {
  city: string;
  days: number;
  stops: ItineraryStop[];
  basedOn: number;
}

/**
 * Builds a suggested route for a city from what people actually did there.
 *
 * Nobody writes these: stops are the distinct places registered in that city,
 * ranked by how many people went, and split across days by the average number
 * of experiences travellers fit into one trip.
 */
export function buildItinerary(
  city: string,
  experiences: Experience[],
  maxStops = 9
): Itinerary | null {
  const inCity = experiences.filter((e) => e.city === city);
  if (inCity.length < 3) return null;

  const byPlace = new Map<string, ItineraryStop>();
  for (const exp of inCity) {
    const existing = byPlace.get(exp.locationName);
    if (existing) {
      existing.timesVisited += 1;
    } else {
      byPlace.set(exp.locationName, {
        locationName: exp.locationName,
        category: exp.category,
        timesVisited: 1,
      });
    }
  }

  const stops = [...byPlace.values()]
    .sort((a, b) => b.timesVisited - a.timesVisited)
    .slice(0, maxStops);

  if (stops.length < 3) return null;

  // Roughly three stops a day is what a comfortable day of travel looks like.
  const days = Math.max(1, Math.ceil(stops.length / 3));

  return { city, days, stops, basedOn: inCity.length };
}

export function splitIntoDays(stops: ItineraryStop[], days: number): ItineraryStop[][] {
  const perDay = Math.ceil(stops.length / days);
  return Array.from({ length: days }, (_, i) =>
    stops.slice(i * perDay, (i + 1) * perDay)
  ).filter((d) => d.length > 0);
}
