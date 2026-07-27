import type { PlanTier } from "../types";

export const planTiers: PlanTier[] = ["Básico", "Pro", "Avançado"];

export interface PlanDef {
  tier: PlanTier;
  price: string;
  tagline: string;
  features: string[];
}

export const plans: PlanDef[] = [
  {
    tier: "Básico",
    price: "Grátis",
    tagline: "Para quem está começando a aparecer no Avena",
    features: [
      "Perfil público com descrição e contato",
      "Aparece nas experiências onde foi marcado",
      "Até 3 fotos no perfil",
    ],
  },
  {
    tier: "Pro",
    price: "R$ 79/mês",
    tagline: "Para agências, guias e restaurantes que querem crescer",
    features: [
      "Tudo do Básico",
      "Destaque nos resultados de busca",
      "Estatísticas de visualizações e avaliações",
      "Fotos e vídeos ilimitados",
    ],
  },
  {
    tier: "Avançado",
    price: "R$ 199/mês",
    tagline: "Para quem quer prioridade máxima e presença de marca",
    features: [
      "Tudo do Pro",
      "Selo de verificado",
      "Prioridade no mapa e nas recomendações da comunidade",
      "Relatórios avançados de audiência",
    ],
  },
];
