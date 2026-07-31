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

/**
 * Cadastur numbers look like 26.123456.10-4. Checking the shape catches a typo
 * before it reaches a traveller's screen; it does NOT prove the registration
 * exists. Only the Ministry's own register can do that, and until the app
 * consults it, the number is what the business told us — which is exactly what
 * the interface has to say.
 */
export function cadasturLooksValid(value: string): boolean {
  return /^\d{2}\.\d{6}\.\d{2}-\d$/.test(value.trim());
}

/** 00.000.000/0000-00 while the person types. */
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Validates the two CNPJ check digits, the same way the Receita Federal does.
 * Catches a typo before it reaches a payment provider and fails there, where
 * the error message will mean nothing to the person who typed it.
 */
export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const check = (length: number): number => {
    let weight = length - 7;
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** 00000-000 while the person types. */
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCEP(value: string): boolean {
  return onlyDigits(value).length === 8;
}

/** (00) 00000-0000 while the person types. */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}
