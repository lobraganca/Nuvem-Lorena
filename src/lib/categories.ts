import type { Category } from "../types";

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
