import type { CancellationPolicy, Difficulty, Tour } from "../types";
import { newId } from "./ids";

/**
 * Bulk import of tours from a spreadsheet.
 *
 * An agency with thirty tours will not fill thirty forms. They already keep
 * that list in Excel or Google Sheets, so the fastest path into the platform is
 * to accept the file they already have.
 */

export interface ImportIssue {
  line: number;
  message: string;
}

export interface ImportResult {
  tours: Tour[];
  issues: ImportIssue[];
}

/** Header names accepted for each field, so the agency need not rename columns. */
const COLUMNS: Record<string, string[]> = {
  title: ["titulo", "título", "nome", "passeio", "produto", "title", "name"],
  description: ["descricao", "descrição", "detalhes", "description"],
  priceFrom: ["preco", "preço", "valor", "price", "preco por pessoa", "preço por pessoa"],
  durationHours: ["duracao", "duração", "horas", "duration"],
  capacityPerDay: ["vagas", "capacidade", "vagas por dia", "capacity", "limite"],
  cancellationPolicy: ["cancelamento", "politica", "política", "cancellation"],
  difficulty: ["esforco", "esforço", "dificuldade", "nivel", "nível", "difficulty"],
};

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

/**
 * Splits one CSV line, honouring quoted fields.
 *
 * Brazilian Excel exports use ";" by default and "," as the decimal separator,
 * which is why the delimiter is detected rather than assumed.
 */
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
  return cells.map((c) => c.trim());
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

/** Parses "R$ 1.234,50", "1234.50" and "1234" alike. */
function parseNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[R$\s]/gi, "");
  if (!cleaned) return undefined;

  // "1.234,50" is Brazilian; "1,234.50" is not. The last separator wins.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function parsePolicy(raw: string): CancellationPolicy | undefined {
  const value = normalizeHeader(raw);
  if (value.startsWith("flex")) return "flexivel";
  if (value.startsWith("mod")) return "moderada";
  if (value.startsWith("rig") || value.startsWith("estrit")) return "rigida";
  return undefined;
}

function parseDifficulty(raw: string): Difficulty | undefined {
  const value = normalizeHeader(raw);
  if (value.startsWith("lev") || value.startsWith("fac")) return "Leve";
  if (value.startsWith("mod") || value.startsWith("med")) return "Moderada";
  if (value.startsWith("pes") || value.startsWith("dif")) return "Pesada";
  return undefined;
}

/**
 * Reads a CSV and returns the tours it could build plus a line-by-line list of
 * what it could not. Nothing is silently dropped: every skipped row is reported
 * so the agency can fix the file instead of wondering what happened.
 */
export function parseToursCsv(text: string): ImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { tours: [], issues: [{ line: 0, message: "O arquivo está vazio." }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);

  const indexOf = (field: keyof typeof COLUMNS): number =>
    headers.findIndex((h) => COLUMNS[field].includes(h));

  const titleIndex = indexOf("title");
  if (titleIndex === -1) {
    return {
      tours: [],
      issues: [
        {
          line: 1,
          message:
            'Não encontrei a coluna do nome do passeio. A primeira linha precisa ter um cabeçalho com "Título" (ou "Nome").',
        },
      ],
    };
  }

  const tours: Tour[] = [];
  const issues: ImportIssue[] = [];
  const seenTitles = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const cell = (index: number) => (index >= 0 ? (cells[index] ?? "") : "");

    const title = cell(titleIndex).replace(/^"|"$/g, "");
    if (!title) {
      issues.push({ line: i + 1, message: "Linha sem nome do passeio, ignorada." });
      continue;
    }

    const key = normalizeHeader(title);
    if (seenTitles.has(key)) {
      issues.push({ line: i + 1, message: `"${title}" aparece mais de uma vez; importei só a primeira.` });
      continue;
    }
    seenTitles.add(key);

    const priceRaw = cell(indexOf("priceFrom"));
    const priceFrom = priceRaw ? parseNumber(priceRaw) : undefined;
    if (priceRaw && priceFrom === undefined) {
      issues.push({ line: i + 1, message: `Não entendi o preço "${priceRaw}" de "${title}".` });
    }

    const durationRaw = cell(indexOf("durationHours"));
    const capacityRaw = cell(indexOf("capacityPerDay"));
    const policyRaw = cell(indexOf("cancellationPolicy"));
    const difficultyRaw = cell(indexOf("difficulty"));

    if (policyRaw && !parsePolicy(policyRaw)) {
      issues.push({
        line: i + 1,
        message: `Política de cancelamento "${policyRaw}" não reconhecida em "${title}"; usei Moderada.`,
      });
    }

    tours.push({
      id: newId(),
      title,
      description: cell(indexOf("description")).replace(/^"|"$/g, "") || undefined,
      priceFrom,
      durationHours: durationRaw ? parseNumber(durationRaw) : undefined,
      capacityPerDay: capacityRaw ? parseNumber(capacityRaw) : undefined,
      cancellationPolicy: parsePolicy(policyRaw) ?? "moderada",
      difficulty: parseDifficulty(difficultyRaw),
    });
  }

  if (tours.length === 0 && issues.length === 0) {
    issues.push({ line: 1, message: "Nenhuma linha de passeio encontrada depois do cabeçalho." });
  }

  return { tours, issues };
}

/** A file the agency can download, fill in and send back. */
export const CSV_TEMPLATE = [
  "Título;Descrição;Preço;Duração;Vagas;Cancelamento;Esforço",
  "Passeio de barco;Saída com paradas para banho;220,00;4;20;Moderada;Leve",
  "Trilha do mirante;Caminhada guiada até o topo;90,00;5;12;Rígida;Pesada",
].join("\n");
