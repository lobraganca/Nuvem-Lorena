import type { PlanTier } from "../types";

export const planTiers: PlanTier[] = ["Básico", "Pro", "Avançado"];

export interface PlanDef {
  tier: PlanTier;
  price: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
}

/**
 * What a business pays to be on Avena.
 *
 * This is the joining fee, and it is the whole of what the business pays:
 * nothing is deducted from a booking, so the price advertised is the price
 * received. The traveller's side is in `pricing.ts`.
 */
export const plans: PlanDef[] = [
  {
    tier: "Básico",
    price: "Grátis",
    priceMonthly: 0,
    tagline: "Para quem está começando a aparecer no Avena",
    features: [
      "Perfil público com descrição e contato",
      "Aparece nas experiências onde foi marcado",
      "Até 3 fotos no perfil",
      "Recebe reservas pelo app",
    ],
  },
  {
    tier: "Pro",
    price: "R$ 39,90/mês",
    priceMonthly: 39.9,
    tagline: "Para agências, guias e restaurantes que querem crescer",
    features: [
      "Tudo do Básico",
      "Destaque nos resultados de busca",
      "Estatísticas de visualizações e avaliações",
      "Fotos e vídeos ilimitados",
      "Recebe reservas pelo app",
    ],
  },
  {
    tier: "Avançado",
    price: "R$ 79/mês",
    priceMonthly: 79,
    tagline: "Para quem quer prioridade máxima e presença de marca",
    features: [
      "Tudo do Pro",
      "Selo de verificado",
      "Prioridade no mapa e nas recomendações da comunidade",
      "Relatórios avançados de audiência",
      "Recebe reservas pelo app",
    ],
  },
];

/**
 * The traveller has no plan and no monthly fee — on purpose. What they pay is
 * the service fee on a booking they chose to make, and nothing when they are
 * only keeping memories.
 */
export const TRAVELER_PAYS_NOTHING_MONTHLY = true;

export function priceMonthlyFor(tier: PlanTier): number {
  return plans.find((p) => p.tier === tier)?.priceMonthly ?? 0;
}
