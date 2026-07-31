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

export const businessTypes: BusinessType[] = [
  "Agência",
  "Guia",
  "Experiência",
  "Restaurante",
  "Hotel",
];

/**
 * Who has to hold a Cadastur registration to sell here.
 *
 * The law binds it to the activity, not to the word on the sign: agencies,
 * guides and lodging are prestadores de serviços turísticos and cannot sell
 * without it. A restaurant is not one. An experience sits in between — a
 * cooking class or a workshop is not a regulated tourism service, while
 * guiding people through a place is, and whoever does that registers as Guia
 * or Agência. So it is asked for, not demanded, and the screen says why.
 *
 * One function because there were two copies of this rule — the registration
 * form and the admin check — and they disagreed.
 */
export function cadasturRequired(type: BusinessType): boolean {
  return type === "Agência" || type === "Guia" || type === "Hotel";
}

/**
 * Cover colour for a business with no photo yet.
 *
 * Earth tones from the brand's own world — forest, olive, taupe,
 * terracotta — rather than the saturated blue, green, orange and purple that
 * were there before. On a page built from deep green and cream, a royal blue
 * card is the loudest thing on the screen and belongs to nobody.
 *
 * All of them clear 6:1 against the white label they carry.
 */
export const businessTypeColor: Record<BusinessType, string> = {
  Agência: "#2f4131",
  Guia: "#55672f",
  /* A fifth earth tone, deeper than the guide's olive so the two do not read
     as the same card at a glance. */
  Experiência: "#3f5546",
  Restaurante: "#7a3a2b",
  Hotel: "#5a4a3a",
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
