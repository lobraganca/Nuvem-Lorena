import type { AccessibilityTag, Difficulty } from "../types";

export const difficulties: Difficulty[] = ["Leve", "Moderada", "Pesada"];

export const accessibilityTags: AccessibilityTag[] = [
  "Cadeirante",
  "Mobilidade reduzida",
  "Crianças",
  "Idosos",
  "Não exige natação",
];

export const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "julho a novembro" for a contiguous run, otherwise a plain list. */
export function seasonLabel(months: number[] | undefined): string | null {
  if (!months || months.length === 0 || months.length === 12) return null;
  const sorted = [...months].sort((a, b) => a - b);
  const contiguous = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 1) {
    return `${MONTH_NAMES[sorted[0] - 1]} a ${MONTH_NAMES[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((m) => MONTH_NAMES[m - 1]).join(", ");
}

export function isInSeason(months: number[] | undefined, date: string): boolean {
  if (!months || months.length === 0) return true;
  return months.includes(new Date(date).getMonth() + 1);
}

/** Months still left in the current season, for gentle urgency. */
export function monthsLeftInSeason(months: number[] | undefined): number | null {
  if (!months || months.length === 0 || months.length === 12) return null;
  const current = new Date().getMonth() + 1;
  if (!months.includes(current)) return null;
  const sorted = [...months].sort((a, b) => a - b);
  const last = sorted[sorted.length - 1];
  return last >= current ? last - current + 1 : null;
}
