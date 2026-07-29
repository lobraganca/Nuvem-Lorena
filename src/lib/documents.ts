import type { DocumentType } from "../types";

export const documentTypes: DocumentType[] = ["CPF", "RG", "Passaporte"];

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats as 000.000.000-00 while the person types. */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Validates the two CPF check digits. Catches typos before they reach the
 * agency's passenger list, where a wrong number can block boarding.
 */
export function isValidCPF(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  // Repeated digits pass the arithmetic but are never real CPFs.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(d[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === Number(d[9]) && checkDigit(10) === Number(d[10]);
}

export function isValidDocument(type: DocumentType, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (type === "CPF") return isValidCPF(trimmed);
  // RG formats vary by state and passports by country, so we only require
  // something plausible rather than rejecting valid documents.
  return onlyDigits(trimmed).length >= 5 || trimmed.length >= 5;
}

export type DocumentErrorKey =
  | "participants.docRequired"
  | "participants.cpfInvalid"
  | "participants.docTooShort";

/** Returns a translation key so the message follows the chosen language. */
export function documentError(
  type: DocumentType,
  value: string
): DocumentErrorKey | null {
  if (!value.trim()) return "participants.docRequired";
  if (type === "CPF" && !isValidCPF(value)) return "participants.cpfInvalid";
  if (type !== "CPF" && !isValidDocument(type, value)) return "participants.docTooShort";
  return null;
}
