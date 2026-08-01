/**
 * Quando um passeio ou uma casa está disponível.
 *
 * Era o buraco central do lado de quem recebe. Só existia "vagas por dia" —
 * um número igual para todos os dias do ano — então o app aceitava reserva
 * para o Natal, para a semana em que o guia viaja e para a segunda-feira em
 * que a casa está em obra. Quem pagava o vexame era a agência, e sempre
 * depois do dinheiro ter entrado.
 *
 * Três coisas moram aqui, e nesta ordem de prioridade quando conflitam:
 *
 *   1. **Data bloqueada** pelo dono. Fecha, sem discussão.
 *   2. **Dia da semana fechado** — a folga fixa, o dia sem saída.
 *   3. **Vagas** já vendidas naquele dia.
 *
 * Datas são strings "AAAA-MM-DD" o tempo todo. Um `Date` do JavaScript carrega
 * fuso horário, e a conta que parece certa às 15h vira o dia anterior às 22h
 * em Brasília — bug que só aparece à noite e some quando se vai investigar.
 */
import type { Tour } from "../types";

/** Domingo é 0, como no JavaScript, para não haver conversão no meio. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  // Meio-dia, e não meia-noite: assim nenhum ajuste de horário de verão
  // empurra a data para o dia anterior.
  return new Date(y, m - 1, d, 12).getDay() as Weekday;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d, 12);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

/** Todos os dias de um mês, para desenhar a grade. */
export function daysOfMonth(year: number, month: number): string[] {
  const total = new Date(year, month, 0).getDate();
  return Array.from(
    { length: total },
    (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
  );
}

export type DayState = "livre" | "bloqueada" | "fechado" | "lotado" | "passada";

/**
 * O estado de um dia, já com a razão.
 *
 * Devolve o porquê e não só um sim/não, porque a tela precisa dizer à pessoa
 * o que houve — "esgotado" e "a empresa não atende neste dia" mandam a
 * pessoa fazer coisas diferentes.
 */
export function dayState(
  tour: Tour,
  date: string,
  bookedSeats: number,
  today = todayISO()
): DayState {
  if (date < today) return "passada";
  if (tour.blockedDates?.includes(date)) return "bloqueada";
  if (tour.closedWeekdays?.includes(weekdayOf(date))) return "fechado";
  if (tour.capacityPerDay !== undefined && bookedSeats >= tour.capacityPerDay)
    return "lotado";
  return "livre";
}

export function isBookable(state: DayState): boolean {
  return state === "livre";
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  livre: "Disponível",
  bloqueada: "A empresa fechou esta data",
  fechado: "A empresa não atende neste dia da semana",
  lotado: "Esgotado nesta data",
  passada: "Data já passada",
};
