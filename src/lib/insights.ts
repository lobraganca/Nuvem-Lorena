import type { Booking, Experience, Person } from "../types";

/**
 * Personalised observations derived from what the person actually lived.
 * Every insight states a fact the data supports — nothing is estimated or
 * invented, so the app never tells someone a trip they did not take.
 */
export interface Insight {
  id: string;
  text: string;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function mostCommon<T>(values: T[]): { value: T; count: number } | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { value, count };
}

export function buildInsights(
  experiences: Experience[],
  people: Person[],
  bookings: Booking[]
): Insight[] {
  const insights: Insight[] = [];
  if (experiences.length === 0) return insights;

  const month = mostCommon(experiences.map((e) => new Date(e.date).getMonth()));
  if (month && month.count >= 2) {
    insights.push({
      id: "mes",
      text: `Você costuma viajar em ${MONTHS[month.value]} — ${month.count} das suas experiências aconteceram nesse mês.`,
    });
  }

  const category = mostCommon(experiences.map((e) => e.category));
  if (category) {
    insights.push({
      id: "categoria",
      text: `Seu tipo de experiência favorito é ${category.value.toLowerCase()}, com ${category.count} registros.`,
    });
  }

  const companion = mostCommon(experiences.flatMap((e) => e.peopleIds));
  if (companion) {
    const person = people.find((p) => p.id === companion.value);
    if (person) {
      insights.push({
        id: "companhia",
        text: `Sua companhia mais frequente é ${person.name}. Vocês já viveram ${companion.count} experiências juntos.`,
      });
    }
  }

  // First time seeing each animal, in chronological order.
  const byDate = [...experiences].sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  for (const exp of byDate) {
    for (const animal of exp.animalsSeen ?? []) {
      if (!seen.has(animal)) {
        seen.add(animal);
        insights.push({
          id: `animal-${animal}`,
          text: `Sua primeira observação de ${animal.toLowerCase()} aconteceu em ${exp.locationName}, em ${new Date(exp.date).toLocaleDateString("pt-BR")}.`,
        });
      }
    }
  }

  const thisYear = new Date().getFullYear();
  const beachesThisYear = new Set(
    experiences
      .filter((e) => e.category === "Praia" && new Date(e.date).getFullYear() === thisYear)
      .map((e) => e.locationName)
  );
  if (beachesThisYear.size > 0) {
    insights.push({
      id: "praias-ano",
      text: `Você conheceu ${beachesThisYear.size} ${beachesThisYear.size === 1 ? "praia nova" : "praias novas"} em ${thisYear}.`,
    });
  }

  const confirmed = bookings.filter((b) => b.status === "confirmada");
  if (confirmed.length >= 2) {
    const spent = confirmed.reduce((s, b) => s + b.totalPrice, 0);
    insights.push({
      id: "reservas",
      text: `Você fechou ${confirmed.length} passeios pelo Avena, somando R$ ${spent.toLocaleString("pt-BR")}.`,
    });
  }

  return insights.slice(0, 6);
}
