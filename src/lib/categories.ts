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

export const businessTypeColor: Record<BusinessType, string> = {
  Agência: "#2563eb",
  Guia: "#65a30d",
  Restaurante: "#b45309",
  Hotel: "#7c3aed",
};
