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
 * The tiers a business can be on.
 *
 * Nobody pays to join. Every business that signs up enters on Básico, which is
 * free and always was; Pro and Avançado are not for sale — they describe what
 * a paid tier would give, for the day there is one, and until then they can
 * only be granted by the admin. That distinction matters: the seal of
 * "verificado" and the priority in results are the two things that would be
 * worthless the moment anyone could switch them on for themselves.
 *
 * So what does Avena live on? The service fee the traveller pays on a booking,
 * in `pricing.ts`, plus the promoted listings in `boosts.ts`. Nothing is
 * deducted from the business: the price it advertises is the price it
 * receives.
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
    price: "Ainda não disponível",
    priceMonthly: 0,
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
    price: "Ainda não disponível",
    priceMonthly: 0,
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

/** The tier every new business starts on: free, and the only one on offer. */
export const DEFAULT_PLAN: PlanTier = "Básico";

/** True while joining costs nothing, which is the decision for the launch. */
export const PLANS_FOR_SALE = false;
