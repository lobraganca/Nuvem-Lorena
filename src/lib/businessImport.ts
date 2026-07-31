import type { Business, BusinessType } from "../types";
import { BRAZILIAN_STATES } from "./collections";
import { newId } from "./ids";

/**
 * Bulk import of partner companies, used by the Avena team to seed a city.
 *
 * A marketplace with no supply attracts no travellers, and a marketplace with
 * no travellers attracts no supply. The way out is to build the catalogue
 * first, with the agencies' permission, and hand each of them a profile that
 * already exists — which is a much easier conversation than an empty form.
 *
 * Anything created this way is marked as not yet claimed, so nobody is
 * presented as a signed-up partner before they actually are.
 */

export interface BusinessImportIssue {
  line: number;
  message: string;
}

export interface BusinessImportResult {
  businesses: Business[];
  issues: BusinessImportIssue[];
}

const COLUMNS: Record<string, string[]> = {
  name: ["nome", "empresa", "razao social", "razão social", "name"],
  type: ["tipo", "categoria", "type"],
  city: ["cidade", "municipio", "município", "city"],
  state: ["estado", "uf", "state"],
  email: ["email", "e-mail", "contato"],
  phone: ["telefone", "fone", "whatsapp", "celular", "phone"],
  website: ["site", "website", "url"],
  cadastur: ["cadastur", "registro"],
  description: ["descricao", "descrição", "sobre", "description"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

function parseType(raw: string): BusinessType | undefined {
  const value = normalize(raw);
  if (value.startsWith("agen")) return "Agência";
  if (value.startsWith("guia")) return "Guia";
  if (value.startsWith("experi")) return "Experiência";
  if (value.startsWith("restaur")) return "Restaurante";
  if (value.startsWith("hot") || value.startsWith("pous")) return "Hotel";
  return undefined;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseBusinessesCsv(
  text: string,
  existing: Business[] = []
): BusinessImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { businesses: [], issues: [{ line: 0, message: "O arquivo está vazio." }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalize);
  const indexOf = (field: keyof typeof COLUMNS): number =>
    headers.findIndex((h) => COLUMNS[field].includes(h));

  const nameIndex = indexOf("name");
  if (nameIndex === -1) {
    return {
      businesses: [],
      issues: [
        {
          line: 1,
          message:
            'Não encontrei a coluna do nome. A primeira linha precisa ter um cabeçalho com "Nome".',
        },
      ],
    };
  }

  const businesses: Business[] = [];
  const issues: BusinessImportIssue[] = [];
  const seen = new Set(existing.map((b) => `${normalize(b.name)}|${normalize(b.city)}`));

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? "") : "");
    const line = i + 1;

    const name = cell(nameIndex);
    if (!name) {
      issues.push({ line, message: "Linha sem nome da empresa, ignorada." });
      continue;
    }

    const city = cell(indexOf("city"));
    if (!city) {
      issues.push({ line, message: `"${name}" está sem cidade; sem isso não aparece na busca.` });
      continue;
    }

    // The same agency can exist in two cities, so the key is name plus city.
    const key = `${normalize(name)}|${normalize(city)}`;
    if (seen.has(key)) {
      issues.push({ line, message: `"${name}" em ${city} já está cadastrada; pulei.` });
      continue;
    }
    seen.add(key);

    const typeRaw = cell(indexOf("type"));
    const type = parseType(typeRaw);
    if (typeRaw && !type) {
      issues.push({
        line,
        message: `Tipo "${typeRaw}" não reconhecido em "${name}"; usei Agência.`,
      });
    }

    const stateRaw = cell(indexOf("state")).toUpperCase();
    const state = BRAZILIAN_STATES.includes(stateRaw) ? stateRaw : undefined;
    if (stateRaw && !state) {
      issues.push({ line, message: `Estado "${stateRaw}" inválido em "${name}".` });
    }

    const email = cell(indexOf("email"));
    if (email && !looksLikeEmail(email)) {
      issues.push({ line, message: `E-mail "${email}" parece inválido em "${name}".` });
    }

    businesses.push({
      id: newId(),
      name,
      type: type ?? "Agência",
      planTier: "Básico",
      description: cell(indexOf("description")) || `${type ?? "Agência"} em ${city}.`,
      city,
      state,
      country: "Brasil",
      email: looksLikeEmail(email) ? email : "",
      phone: cell(indexOf("phone")) || undefined,
      website: cell(indexOf("website")) || undefined,
      cadastur: cell(indexOf("cadastur")) || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
      // Nobody signed up yet: this is a profile Avena created to be claimed.
      claimStatus: "nao-reivindicada",
    });
  }

  if (businesses.length === 0 && issues.length === 0) {
    issues.push({ line: 1, message: "Nenhuma empresa encontrada depois do cabeçalho." });
  }

  return { businesses, issues };
}

export const BUSINESS_CSV_TEMPLATE = [
  "Nome;Tipo;Cidade;Estado;E-mail;Telefone;Site;Cadastur;Descrição",
  "Mar Aberto Turismo;Agência;Arraial do Cabo;RJ;contato@maraberto.com.br;(22) 99999-0000;maraberto.com.br;26.111111.10-0;Passeios de barco e mergulho",
  "João Guia Local;Guia;Ouro Preto;MG;joao@email.com;(31) 98888-0000;;26.222222.10-1;Caminhadas pelo centro histórico",
].join("\n");
