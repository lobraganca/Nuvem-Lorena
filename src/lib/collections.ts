import type { Experience } from "../types";

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const REGION_BY_STATE: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const BRAZIL_REGIONS = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export type CollectionKey =
  | "collection.states"
  | "collection.regions"
  | "collection.waterfalls"
  | "collection.beaches"
  | "collection.trails"
  | "collection.parks"
  | "collection.museums"
  | "collection.animals";

export interface Collection {
  id: string;
  /** Translation key; the label is resolved by whoever renders it. */
  titleKey: CollectionKey;
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

  const regions = uniqueValues(brazilStates.map((s) => REGION_BY_STATE[s]));

  const byCategory = (category: Experience["category"]) =>
    uniqueValues(
      experiences.filter((e) => e.category === category).map((e) => e.locationName)
    ).length;

  const animals = uniqueValues(experiences.flatMap((e) => e.animalsSeen ?? [])).length;

  return [
    { id: "states", titleKey: "collection.states", achieved: brazilStates.length, total: BRAZILIAN_STATES.length },
    { id: "regions", titleKey: "collection.regions", achieved: regions.length, total: BRAZIL_REGIONS.length },
    { id: "waterfalls", titleKey: "collection.waterfalls", achieved: byCategory("Cachoeira"), total: 30 },
    { id: "beaches", titleKey: "collection.beaches", achieved: byCategory("Praia"), total: 50 },
    { id: "trails", titleKey: "collection.trails", achieved: byCategory("Trilha"), total: 25 },
    { id: "parks", titleKey: "collection.parks", achieved: byCategory("Parque"), total: 15 },
    { id: "museums", titleKey: "collection.museums", achieved: byCategory("Museu"), total: 20 },
    { id: "animals", titleKey: "collection.animals", achieved: animals, total: 20 },
  ];
}
