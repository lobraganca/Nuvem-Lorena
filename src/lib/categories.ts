import type { BusinessType, Category } from "../types";

export const categories: Category[] = [
  "Viagem",
  "Trilha",
  "Praia",
  "Cachoeira",
  "Observação de animais",
  "Restaurante",
  "Museu",
  "Parque",
  "Cidade",
  "Outro",
];

// Used only for map pin markers (MapView) — a visual necessity on a map.
export const categoryEmoji: Record<Category, string> = {
  Viagem: "✈️",
  Trilha: "🥾",
  Praia: "🏖️",
  Cachoeira: "💦",
  "Observação de animais": "🐋",
  Restaurante: "🍽️",
  Museu: "🖼️",
  Parque: "🌳",
  Cidade: "🏙️",
  Outro: "📍",
};

export const categoryColor: Record<Category, string> = {
  Viagem: "#2563eb",
  Trilha: "#65a30d",
  Praia: "#0891b2",
  Cachoeira: "#0284c7",
  "Observação de animais": "#4338ca",
  Restaurante: "#b45309",
  Museu: "#7c3aed",
  Parque: "#15803d",
  Cidade: "#475569",
  Outro: "#6b7280",
};

export const businessTypes: BusinessType[] = ["Agência", "Guia", "Restaurante", "Hotel"];

/**
 * Cover colour for a business with no photo yet. Dark enough that the white
 * type label on top of it stays readable.
 */
export const businessTypeColor: Record<BusinessType, string> = {
  Agência: "#1d4ed8",
  Guia: "#3f6212",
  Restaurante: "#9a3412",
  Hotel: "#6d28d9",
};

/** Best-effort category guess from a tour title, used to pre-fill a memory. */
export function categoryForTour(title: string): Category {
  const t = title.toLowerCase();
  if (/(baleia|golfinho|ave|animal|fauna)/.test(t)) return "Observação de animais";
  if (/(trilha|trekking|caminhada)/.test(t)) return "Trilha";
  if (/(cachoeira|queda)/.test(t)) return "Cachoeira";
  if (/(praia|ba[ií]a|mergulho|barco|mar)/.test(t)) return "Praia";
  if (/(museu|hist[oó]ric)/.test(t)) return "Museu";
  if (/(parque|reserva)/.test(t)) return "Parque";
  if (/(restaurante|gastron)/.test(t)) return "Restaurante";
  return "Viagem";
}
