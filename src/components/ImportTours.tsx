import { useRef, useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { CSV_TEMPLATE, parseToursCsv, type ImportResult } from "../lib/tourImport";
import { formatBRL } from "../lib/money";

/** Bulk import from the spreadsheet the agency already keeps. */
export function ImportTours({ businessId }: { businessId: string }) {
  const { addTourToBusiness } = useAvena();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  function preview(text: string) {
    setResult(parseToursCsv(text));
    setImported(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    preview(await file.text());
    if (inputRef.current) inputRef.current.value = "";
  }

  function confirmImport() {
    if (!result) return;
    for (const tour of result.tours) addTourToBusiness(businessId, tour);
    setImported(result.tours.length);
    setResult(null);
    setPasted("");
  }

  function downloadTemplate() {
    // The BOM makes Excel open the accented headers correctly.
    const blob = new Blob([`﻿${CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "avena-modelo-passeios.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="import-tours">
      <h3>Importar vários passeios de uma vez</h3>
      <p className="muted">
        Se você já tem sua lista de passeios numa planilha, envie o arquivo em vez
        de cadastrar um por um. Aceita CSV do Excel e do Google Planilhas, com
        ponto e vírgula ou vírgula.
      </p>

      <div className="chip-row">
        <button type="button" className="btn-outline" onClick={downloadTemplate}>
          Baixar planilha modelo
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => inputRef.current?.click()}
        >
          Enviar arquivo CSV
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={handleFile}
          aria-label="Enviar arquivo CSV de passeios"
        />
      </div>

      <label>
        Ou cole as linhas da sua planilha aqui
        <textarea
          rows={4}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"Título;Preço;Duração;Vagas\nPasseio de barco;220,00;4;20"}
        />
      </label>
      {pasted.trim() && (
        <button type="button" className="btn-outline" onClick={() => preview(pasted)}>
          Conferir o que vou importar
        </button>
      )}

      {imported !== null && (
        <p className="availability-note" role="status">
          {imported === 1
            ? "1 passeio importado e já publicado."
            : `${imported} passeios importados e já publicados.`}{" "}
          Confira os preços antes de divulgar.
        </p>
      )}

      {result && (
        <div className="import-preview">
          <h4>
            {result.tours.length === 1
              ? "1 passeio pronto para importar"
              : `${result.tours.length} passeios prontos para importar`}
          </h4>

          {result.tours.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Passeio</th>
                    <th>Preço</th>
                    <th>Duração</th>
                    <th>Vagas</th>
                    <th>Cancelamento</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tours.map((tour) => (
                    <tr key={tour.id}>
                      <td>{tour.title}</td>
                      <td>
                        {tour.priceFrom !== undefined ? `R$ ${formatBRL(tour.priceFrom)}` : "—"}
                      </td>
                      <td>{tour.durationHours ?? "—"}</td>
                      <td>{tour.capacityPerDay ?? "ilimitado"}</td>
                      <td>{tour.cancellationPolicy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.issues.length > 0 && (
            <div className="import-issues">
              <strong>O que eu não consegui ler:</strong>
              <ul>
                {result.issues.map((issue, i) => (
                  <li key={i}>
                    {issue.line > 0 ? `Linha ${issue.line}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="chip-row">
            {result.tours.length > 0 && (
              <button type="button" className="btn-primary" onClick={confirmImport}>
                Importar {result.tours.length}{" "}
                {result.tours.length === 1 ? "passeio" : "passeios"}
              </button>
            )}
            <button type="button" className="btn-outline" onClick={() => setResult(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
