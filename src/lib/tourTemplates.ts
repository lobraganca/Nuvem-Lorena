import type { AccessibilityTag, CancellationPolicy, Difficulty, Tour } from "../types";

/**
 * Ready-made starting points for the most common kinds of tour sold in Brazil.
 *
 * Publishing a tour from scratch means answering nine questions about a product
 * the agency already knows by heart; that is where most of them give up. A
 * template turns the job into picking the closest match and correcting the
 * price, which is the difference between an agency that publishes and one that
 * abandons the form.
 */
export interface TourTemplate {
  id: string;
  label: string;
  /** What kind of business this template makes sense for. */
  hint: string;
  values: Omit<Tour, "id">;
}

const defaults = {
  cancellationPolicy: "moderada" as CancellationPolicy,
};

export const tourTemplates: TourTemplate[] = [
  {
    id: "barco",
    label: "Passeio de barco",
    hint: "Agências náuticas, escunas, lanchas",
    values: {
      ...defaults,
      title: "Passeio de barco",
      description:
        "Saída de barco com paradas para banho e tempo livre nas praias. Inclui equipamento de segurança e acompanhamento da tripulação.",
      durationHours: 4,
      capacityPerDay: 20,
      difficulty: "Leve" as Difficulty,
      accessibility: ["Crianças", "Idosos"] as AccessibilityTag[],
    },
  },
  {
    id: "mergulho",
    label: "Mergulho",
    hint: "Operadoras de mergulho e batismo",
    values: {
      ...defaults,
      title: "Batismo de mergulho",
      description:
        "Mergulho acompanhado por instrutor credenciado, com todo o equipamento incluso. Não é necessária experiência prévia.",
      durationHours: 3,
      capacityPerDay: 8,
      difficulty: "Moderada" as Difficulty,
      cancellationPolicy: "rigida" as CancellationPolicy,
    },
  },
  {
    id: "trilha",
    label: "Trilha guiada",
    hint: "Guias de montanha e ecoturismo",
    values: {
      ...defaults,
      title: "Trilha guiada",
      description:
        "Caminhada guiada com paradas para descanso e orientações sobre a fauna e a flora do percurso. Leve água e protetor solar.",
      durationHours: 5,
      capacityPerDay: 12,
      difficulty: "Pesada" as Difficulty,
      accessibility: ["Não exige natação"] as AccessibilityTag[],
    },
  },
  {
    id: "cachoeira",
    label: "Circuito de cachoeiras",
    hint: "Guias locais e receptivos",
    values: {
      ...defaults,
      title: "Circuito de cachoeiras",
      description:
        "Visita a cachoeiras da região com transporte, guia local e tempo para banho em cada parada.",
      durationHours: 6,
      capacityPerDay: 15,
      difficulty: "Moderada" as Difficulty,
    },
  },
  {
    id: "city-tour",
    label: "City tour histórico",
    hint: "Guias de turismo urbano",
    values: {
      ...defaults,
      title: "City tour histórico",
      description:
        "Caminhada pelo centro histórico com guia credenciado, passando pelos principais monumentos e contando a história da cidade.",
      durationHours: 3,
      capacityPerDay: 25,
      difficulty: "Leve" as Difficulty,
      accessibility: ["Cadeirante", "Mobilidade reduzida", "Idosos", "Não exige natação"] as AccessibilityTag[],
      cancellationPolicy: "flexivel" as CancellationPolicy,
    },
  },
  {
    id: "gastronomico",
    label: "Experiência gastronômica",
    hint: "Restaurantes e chefs",
    values: {
      ...defaults,
      title: "Experiência gastronômica",
      description:
        "Menu degustação com pratos da cozinha regional, apresentado pelo chef. Opções vegetarianas mediante aviso prévio.",
      durationHours: 2,
      capacityPerDay: 30,
      difficulty: "Leve" as Difficulty,
      accessibility: ["Cadeirante", "Mobilidade reduzida", "Crianças", "Idosos", "Não exige natação"] as AccessibilityTag[],
      cancellationPolicy: "flexivel" as CancellationPolicy,
    },
  },
  {
    id: "observacao",
    label: "Observação de fauna",
    hint: "Baleias, golfinhos, aves",
    values: {
      ...defaults,
      title: "Observação de fauna",
      description:
        "Saída com biólogo ou guia especializado para observação de animais em seu ambiente natural, respeitando a distância mínima exigida por lei.",
      durationHours: 4,
      capacityPerDay: 18,
      difficulty: "Leve" as Difficulty,
      // Most wildlife watching in Brazil is seasonal, so the template says so.
      seasonMonths: [7, 8, 9, 10, 11],
    },
  },
  {
    id: "hospedagem",
    label: "Diária com experiência",
    hint: "Hotéis e pousadas",
    values: {
      ...defaults,
      title: "Diária com café da manhã",
      description:
        "Hospedagem com café da manhã incluso e apoio da equipe para organizar os passeios da região.",
      durationHours: 24,
      capacityPerDay: 10,
      difficulty: "Leve" as Difficulty,
      cancellationPolicy: "flexivel" as CancellationPolicy,
    },
  },
];

export function templateById(id: string): TourTemplate | undefined {
  return tourTemplates.find((t) => t.id === id);
}
