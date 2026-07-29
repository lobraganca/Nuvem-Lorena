import type { Booking, Experience, Person } from "../types";
import { buildCollections, type CollectionKey } from "./collections";
import { profileStats } from "./stats";

export interface Retrospective {
  year: number;
  hasData: boolean;
  experiences: number;
  cities: number;
  states: number;
  trails: number;
  beaches: number;
  waterfalls: number;
  animals: string[];
  newPlaces: number;
  topCompanion?: { name: string; count: number };
  bestTrip?: Experience;
  busiestMonth?: { month: string; count: number };
  completedCollections: CollectionKey[];
  spent: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function availableYears(experiences: Experience[]): number[] {
  return Array.from(
    new Set(experiences.map((e) => new Date(e.date).getFullYear()))
  ).sort((a, b) => b - a);
}

export function buildRetrospective(
  year: number,
  experiences: Experience[],
  people: Person[],
  bookings: Booking[]
): Retrospective {
  const inYear = experiences.filter((e) => new Date(e.date).getFullYear() === year);
  const before = experiences.filter((e) => new Date(e.date).getFullYear() < year);
  const knownPlaces = new Set(before.map((e) => e.locationName));

  const stats = profileStats(inYear);

  const companionCounts = new Map<string, number>();
  for (const exp of inYear) {
    for (const id of exp.peopleIds) {
      companionCounts.set(id, (companionCounts.get(id) ?? 0) + 1);
    }
  }
  const top = [...companionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPerson = top ? people.find((p) => p.id === top[0]) : undefined;

  const monthCounts = new Map<number, number>();
  for (const exp of inYear) {
    const m = new Date(exp.date).getMonth();
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  const busiest = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Best trip = highest rated; ties broken by the one with most people along.
  const bestTrip = [...inYear].sort((a, b) => {
    const rating = (b.rating ?? 0) - (a.rating ?? 0);
    return rating !== 0 ? rating : b.peopleIds.length - a.peopleIds.length;
  })[0];

  const completed = buildCollections(inYear)
    .filter((c) => c.achieved >= c.total)
    .map((c) => c.titleKey);

  const spent = bookings
    .filter(
      (b) => b.status === "confirmada" && new Date(b.travelDate).getFullYear() === year
    )
    .reduce((s, b) => s + b.totalPrice, 0);

  return {
    year,
    hasData: inYear.length > 0,
    experiences: inYear.length,
    cities: stats.cities,
    states: stats.states,
    trails: stats.trails,
    beaches: stats.beaches,
    waterfalls: stats.waterfalls,
    animals: Array.from(new Set(inYear.flatMap((e) => e.animalsSeen ?? []))),
    newPlaces: new Set(
      inYear.filter((e) => !knownPlaces.has(e.locationName)).map((e) => e.locationName)
    ).size,
    topCompanion: topPerson ? { name: topPerson.name, count: top![1] } : undefined,
    bestTrip,
    busiestMonth: busiest ? { month: MONTHS[busiest[0]], count: busiest[1] } : undefined,
    completedCollections: completed,
    spent,
  };
}
