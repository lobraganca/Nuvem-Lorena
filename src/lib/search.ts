import type { Business } from "../types";

/** Full state names, so "Minas Gerais" finds what "MG" finds. */
export const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
  RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe",
  TO: "Tocantins",
};

export const REGION_BY_STATE: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

/** Lowercases and strips accents, so "ceara" matches "Ceará". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Levenshtein distance, capped for speed. Used only to forgive typing slips,
 * never to widen a search that already found something.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** How many typos we forgive, scaled to the length of what was typed. */
function tolerance(term: string): number {
  if (term.length <= 4) return 1;
  if (term.length <= 8) return 2;
  return 3;
}

/**
 * Palavras que ligam a frase e não dizem nada sobre o lugar.
 *
 * Elas ficam de fora da comparação por aproximação, e o motivo é um caso real:
 * quem procurava "Paraty" recebia uma agência de Arraial do Cabo, porque o
 * passeio se chamava "barco **para** observação de baleias" e "para" está a
 * dois toques de "Paraty". A busca dizia "1 resultado em Paraty" e mostrava
 * outra cidade — pior do que não achar nada.
 */
const LIGACOES = new Set([
  "a", "as", "o", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na",
  "nos", "nas", "por", "para", "com", "sem", "ao", "aos", "um", "uma", "que",
  "the", "of", "in", "for", "and",
]);

/** True when the term is contained in the text, or is a near-miss of a word in it. */
export function looselyMatches(text: string, term: string): boolean {
  const haystack = normalize(text);
  const needle = normalize(term);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;

  const allowed = tolerance(needle);
  return haystack
    .split(/[\s,·-]+/)
    .some(
      (word) =>
        word.length >= 3 &&
        !LIGACOES.has(word) &&
        // Perto no comprimento, além de perto nas letras: sem isto, uma
        // palavra curta continua "quase igual" a um nome comprido.
        Math.abs(word.length - needle.length) <= allowed &&
        editDistance(word, needle) <= allowed
    );
}

/** Every text about a business that a person might reasonably type. */
function searchableFields(business: Business): string[] {
  const uf = business.state ?? "";
  return [
    business.name,
    business.city,
    uf,
    STATE_NAMES[uf] ?? "",
    REGION_BY_STATE[uf] ?? "",
    business.type,
    ...(business.tours ?? []).map((t) => t.title),
  ].filter(Boolean);
}

/**
 * A cidade que o termo nomeia, entre as que existem no Avena, ou null.
 *
 * Serve para a busca por lugar ser uma busca por lugar: quem digita "Paraty"
 * quer o que há em Paraty, e um passeio de outra cidade cujo nome por acaso
 * lembra a palavra não é resposta — é ruído que faz a pessoa desconfiar da
 * lista inteira.
 */
export function cityFromTerm(businesses: Business[], term: string): string | null {
  const needle = normalize(term);
  if (needle.length < 3) return null;
  const cidades = [...new Set(businesses.map((b) => b.city))];
  // Igual primeiro; só depois o quase-igual, para "Paraty" nunca cair numa
  // cidade parecida quando a exata existe.
  const exata = cidades.find((c) => normalize(c) === needle);
  if (exata) return exata;
  return cidades.find((c) => looselyMatches(c, term)) ?? null;
}

export function businessMatches(business: Business, term: string): boolean {
  if (!term.trim()) return false;
  const uf = business.state ?? "";
  const needle = normalize(term);

  // A two-letter term is a state code, not a fragment of a city name —
  // otherwise "MG" would match every city containing those letters.
  if (needle.length === 2) return normalize(uf) === needle;

  return searchableFields(business).some((field) => looselyMatches(field, term));
}

export interface Suggestion {
  label: string;
  /** What to put in the search box when the person picks it. */
  term: string;
  hint: string;
}

/**
 * What to offer when a search comes back empty: the closest city names first,
 * then whatever exists in the same state or region, so the screen is never a
 * dead end.
 */
export function suggestionsFor(businesses: Business[], term: string): Suggestion[] {
  const needle = normalize(term);
  if (!needle) return [];

  const cities = new Map<string, Business>();
  for (const b of businesses) if (!cities.has(b.city)) cities.set(b.city, b);

  const scored = [...cities.entries()]
    .map(([city, business]) => {
      const distance = Math.min(
        ...normalize(city)
          .split(/\s+/)
          .map((word) => editDistance(word, needle)),
        editDistance(normalize(city), needle)
      );
      return { city, business, distance };
    })
    .filter((entry) => entry.distance <= 4)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);

  if (scored.length > 0) {
    return scored.map(({ city, business }) => ({
      label: city,
      term: city,
      hint: `${business.state ? `${STATE_NAMES[business.state] ?? business.state} · ` : ""}${
        businesses.filter((b) => b.city === city).length
      } parceiros`,
    }));
  }

  // Nothing close by name: offer the busiest cities as a starting point.
  const byCount = [...cities.keys()]
    .map((city) => ({
      city,
      count: businesses.filter((b) => b.city === city).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return byCount.map(({ city, count }) => ({
    label: city,
    term: city,
    hint: `${count} ${count === 1 ? "parceiro" : "parceiros"}`,
  }));
}

/**
 * Resolves what the person typed to an actual city name, tolerating typos, so
 * features keyed on a city (like the community itinerary) still work.
 */
export function resolveCity(cities: string[], term: string): string | undefined {
  const needle = normalize(term);
  if (!needle) return undefined;

  return (
    cities.find((c) => normalize(c) === needle) ??
    cities.find((c) => normalize(c).includes(needle)) ??
    cities.find((c) => looselyMatches(c, term))
  );
}
