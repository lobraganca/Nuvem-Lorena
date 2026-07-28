import type { PlanTier } from "../types";

export const planTiers: PlanTier[] = ["Básico", "Pro", "Avançado"];

export interface PlanDef {
  tier: PlanTier;
  price: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
  commissionRate: number; // fraction of each booking kept by Avena
}

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
      "Reservas pelo app com taxa de 15%",
    ],
    commissionRate: 0.15,
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
      "Reservas pelo app com taxa reduzida de 10%",
    ],
    commissionRate: 0.1,
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
      "Menor taxa de reservas do Avena: apenas 7%",
    ],
    commissionRate: 0.07,
  },
];

export type TravelerPlanTier = "Explorador" | "Avena Plus";

export interface TravelerPlanDef {
  tier: TravelerPlanTier;
  price: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
}

export const travelerPlans: TravelerPlanDef[] = [
  {
    tier: "Explorador",
    price: "Grátis",
    priceMonthly: 0,
    tagline: "Para começar a colecionar suas memórias",
    features: [
      "Mapa afetivo com experiências ilimitadas",
      "Perfil, pessoas e linha do tempo",
      "Reservar passeios com agências verificadas",
      "Até 3 fotos por experiência",
    ],
  },
  {
    tier: "Avena Plus",
    price: "R$ 9,90/mês",
    priceMonthly: 9.9,
    tagline: "Para quem vive muito e quer guardar tudo",
    features: [
      "Tudo do Explorador",
      "Fotos e vídeos ilimitados por experiência",
      "Retrospectiva anual das suas viagens",
      "Todas as coleções e estatísticas de amizade",
      "Insights personalizados sobre seus destinos",
    ],
  },
];

export function commissionRateFor(tier: PlanTier): number {
  return plans.find((p) => p.tier === tier)?.commissionRate ?? 0.15;
}

export function priceMonthlyFor(tier: PlanTier): number {
  return plans.find((p) => p.tier === tier)?.priceMonthly ?? 0;
}
