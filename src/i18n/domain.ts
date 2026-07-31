import type {
  AccessibilityTag,
  BusinessType,
  Category,
  Difficulty,
  PlanTier,
} from "../types";
import type { TranslationKey } from "./index";

/**
 * Display names for values that are *stored* in Portuguese.
 *
 * Category, business type and the rest are part of the data: they end up in
 * saved experiences, in imported spreadsheets and in the admin panel, so they
 * stay Portuguese on disk. Only what the traveller reads is translated, which
 * keeps a memory recorded in English readable by the Brazilian agency that
 * hosted it.
 */

export const categoryKey: Record<Category, TranslationKey> = {
  Viagem: "category.viagem",
  Trilha: "category.trilha",
  Praia: "category.praia",
  Cachoeira: "category.cachoeira",
  "Observação de animais": "category.animais",
  Restaurante: "category.restaurante",
  Museu: "category.museu",
  Parque: "category.parque",
  Cidade: "category.cidade",
  Outro: "category.outro",
};

export const businessTypeKey: Record<BusinessType, TranslationKey> = {
  Agência: "businessType.agencia",
  Guia: "businessType.guia",
  Experiência: "businessType.experiencia",
  Restaurante: "businessType.restaurante",
  Hotel: "businessType.hotel",
};

/** Plural form, used on the tabs of the destination search. */
export const businessTypePluralKey: Record<BusinessType, TranslationKey> = {
  Agência: "businessType.agenciaPlural",
  Guia: "businessType.guiaPlural",
  Experiência: "businessType.experienciaPlural",
  Restaurante: "businessType.restaurantePlural",
  Hotel: "businessType.hotelPlural",
};

export const planTierKey: Record<PlanTier, TranslationKey> = {
  Básico: "plan.basico",
  Pro: "plan.pro",
  Avançado: "plan.avancado",
};

export const difficultyKey: Record<Difficulty, TranslationKey> = {
  Leve: "difficulty.leve",
  Moderada: "difficulty.moderada",
  Pesada: "difficulty.pesada",
};

export const accessibilityKey: Record<AccessibilityTag, TranslationKey> = {
  Cadeirante: "access.cadeirante",
  "Mobilidade reduzida": "access.mobilidade",
  Crianças: "access.criancas",
  Idosos: "access.idosos",
  "Não exige natação": "access.natacao",
};
