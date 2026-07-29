/**
 * Moderation of text people write in public parts of the app.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It does not censor criticism. "Péssimo", "não recomendo", "atrasou duas
 *    horas" are exactly what a review platform exists for. Only offence is
 *    blocked, never a bad rating.
 *
 * 2. It does not judge words that are innocent in a travel app. "Piranha" is a
 *    fish people fish for, "macaco" is an animal people photograph, "rola" is
 *    a verb, "pau" is in "pau-brasil". A list that flagged those would be
 *    useless here, so ambiguous words are left out on purpose and handled by
 *    the reporting channel instead.
 *
 * A word list catches the obvious and the careless. It does not catch context
 * ("volta pra sua terra"), sarcasm, or slurs spelled in ways nobody predicted.
 * That is why it stands next to the report button and the admin's power to
 * remove a review — not instead of them.
 */

export type ModerationCategory = "palavrao" | "sexual" | "odio" | "ameaca";

export type ModerationSeverity = "ok" | "bloqueado";

export interface ModerationResult {
  severity: ModerationSeverity;
  categories: ModerationCategory[];
}

/**
 * Single words, matched whole. Word boundaries matter: without them "puta"
 * would flag "reputação" and "disputa", and "cu" would flag "cuidado",
 * "cultura" and "documento".
 */
const WORDS: Record<ModerationCategory, string[]> = {
  palavrao: [
    "porra", "caralho", "merda", "bosta", "cacete", "puta", "putas", "putaria",
    "foda", "fodas", "foder", "fodido", "fodida", "fudido", "arrombado",
    "arrombada", "otario", "otaria", "babaca", "escroto", "escrota",
    "desgracado", "desgracada", "corno", "cornos", "vagabunda", "vagabundas",
    "cuzao", "cuzão", "filhadaputa", "fdp", "pqp", "vsf", "vtnc", "krl",
  ],
  sexual: [
    "buceta", "boceta", "bucetas", "xoxota", "pica", "piroca", "punheta",
    "boquete", "pornografia", "pornografico", "pornografica", "nudes",
    "siririca", "putinha", "sexo", "transar", "transei", "gozada",
  ],
  odio: [
    "viado", "viados", "bicha", "bichas", "traveco", "sapatao", "sapatão",
    "crioulo", "crioula", "macumbeiro", "macumbeira", "retardado", "retardada",
    "mongoloide", "aleijado", "aleijada", "nazista", "hitler",
  ],
  ameaca: ["estupro", "estuprar", "estuprador"],
};

/**
 * Multi-word patterns. Needed where every individual word is innocent:
 * "programa" and "acompanhante" are ordinary travel words, and only the phrase
 * means something else.
 */
const PHRASES: Record<ModerationCategory, RegExp[]> = {
  palavrao: [/\bfilh[oa] da put[ao]\b/, /\bvai (se|te) fud\w*/, /\btom[ae] no cu\b/],
  sexual: [
    /\bgarot[ao] de programa\b/,
    /\bprograma sexual\b/,
    /\bacompanhante de luxo\b/,
    /\bconteudo adulto\b/,
    /\bsexo (grupal|explicito|casual)\b/,
  ],
  odio: [
    /\bvolta pra tua terra\b/,
    /\bvolta pra sua terra\b/,
    /\bnao servem? pra nada\b.{0,20}\b(negr|nordestin|indi)\w*/,
  ],
  ameaca: [
    /\bvou te (matar|pegar|quebrar|acabar)\b/,
    /\bte (mato|quebro|arrebento)\b/,
    /\bvou (acabar|explodir) com voce\b/,
    /\bsei onde voce mora\b/,
  ],
};

/** Digits and symbols people substitute for letters when dodging a filter. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a",
  $: "s", "!": "i", "*": "", "+": "", ".": " ", _: " ", "-": " ",
};

/**
 * Lowercases, strips accents, undoes common letter substitutions and collapses
 * stretched letters, so "p0rraaaa" and "c@r&lho" are seen for what they are.
 */
export function normalizeForModeration(text: string): string {
  const deaccented = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const unleeted = [...deaccented].map((c) => LEET[c] ?? c).join("");

  return unleeted
    // "porraaaa" -> "porra"; three or more of the same letter is never a word.
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function moderate(text: string): ModerationResult {
  const normalized = normalizeForModeration(text);
  if (!normalized) return { severity: "ok", categories: [] };

  const found = new Set<ModerationCategory>();

  for (const [category, words] of Object.entries(WORDS) as [
    ModerationCategory,
    string[],
  ][]) {
    for (const word of words) {
      const normalizedWord = normalizeForModeration(word);
      if (!normalizedWord) continue;
      if (new RegExp(`\\b${normalizedWord}\\b`).test(normalized)) {
        found.add(category);
        break;
      }
    }
  }

  for (const [category, patterns] of Object.entries(PHRASES) as [
    ModerationCategory,
    RegExp[],
  ][]) {
    if (patterns.some((pattern) => pattern.test(normalized))) found.add(category);
  }

  const categories = [...found];
  return {
    severity: categories.length > 0 ? "bloqueado" : "ok",
    categories,
  };
}

/** Translation key explaining why the text was refused. */
export function moderationMessageKey(
  result: ModerationResult
): "moderation.hate" | "moderation.threat" | "moderation.sexual" | "moderation.profanity" | null {
  if (result.severity === "ok") return null;
  // Most serious category first, so the message matches the real problem.
  if (result.categories.includes("odio")) return "moderation.hate";
  if (result.categories.includes("ameaca")) return "moderation.threat";
  if (result.categories.includes("sexual")) return "moderation.sexual";
  return "moderation.profanity";
}
