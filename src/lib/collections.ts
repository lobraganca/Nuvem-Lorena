import type { Experience } from "../types";

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export interface Collection {
  id: string;
  title: string;
  emoji: string;
  achieved: number;
  total: number;
}

function uniqueValues<T>(values: (T | undefined)[]): T[] {
  return Array.from(new Set(values.filter((v): v is T => v != null)));
}

export function buildCollections(experiences: Experience[]): Collection[] {
  const brazilStates = uniqueValues(
    experiences
      .filter((e) => e.country === "Brasil")
      .map((e) => e.state)
  ).filter((s) => BRAZILIAN_STATES.includes(s));

  const countries = uniqueValues(experiences.map((e) => e.country));

  const byCategory = (category: Experience["category"]) =>
    uniqueValues(
      experiences.filter((e) => e.category === category).map((e) => e.locationName)
    ).length;

  const animals = uniqueValues(experiences.flatMap((e) => e.animalsSeen ?? [])).length;

  return [
    { id: "states", title: "Estados brasileiros", emoji: "🗺️", achieved: brazilStates.length, total: BRAZILIAN_STATES.length },
    { id: "countries", title: "Países", emoji: "🌍", achieved: countries.length, total: 195 },
    { id: "waterfalls", title: "Cachoeiras", emoji: "💦", achieved: byCategory("Cachoeira"), total: 30 },
    { id: "beaches", title: "Praias", emoji: "🏖️", achieved: byCategory("Praia"), total: 50 },
    { id: "trails", title: "Trilhas", emoji: "🥾", achieved: byCategory("Trilha"), total: 25 },
    { id: "parks", title: "Parques", emoji: "🌳", achieved: byCategory("Parque"), total: 15 },
    { id: "museums", title: "Museus", emoji: "🖼️", achieved: byCategory("Museu"), total: 20 },
    { id: "animals", title: "Animais observados", emoji: "🐋", achieved: animals, total: 20 },
  ];
}
