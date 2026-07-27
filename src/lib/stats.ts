import type { Experience } from "../types";

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): K[] {
  return Array.from(new Set(items.map(key)));
}

export function profileStats(experiences: Experience[]) {
  return {
    total: experiences.length,
    cities: uniqueBy(experiences, (e) => e.city).length,
    states: uniqueBy(
      experiences.filter((e) => e.state).map((e) => e.state!),
      (s) => s
    ).length,
    countries: uniqueBy(experiences, (e) => e.country).length,
    trails: experiences.filter((e) => e.category === "Trilha").length,
    beaches: experiences.filter((e) => e.category === "Praia").length,
    waterfalls: experiences.filter((e) => e.category === "Cachoeira").length,
    animalSightings: experiences.filter(
      (e) => (e.animalsSeen?.length ?? 0) > 0
    ).length,
  };
}

export function sharedExperiences(experiences: Experience[], personId: string) {
  return experiences.filter((e) => e.peopleIds.includes(personId));
}

export function friendshipStats(experiences: Experience[], personId: string) {
  const shared = sharedExperiences(experiences, personId);
  return {
    ...profileStats(shared),
    shared,
  };
}
