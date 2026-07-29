import { useRef, useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { ImportTours } from "./ImportTours";
import { wantedDestinations } from "../lib/wishlist";
import {
  BUSINESS_CSV_TEMPLATE,
  parseBusinessesCsv,
  type BusinessImportResult,
} from "../lib/businessImport";

/**
 * Where the Avena team seeds a city: import the partner list, then import each
 * partner's tours. The profiles created here are explicitly unclaimed until
 * the agency itself takes them over.
 */
export function AdminImport() {
  const { businesses, addBusiness, wishlist } = useAvena();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<BusinessImportResult | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [tourTarget, setTourTarget] = useState("");

  function preview(text: string) {
    setResult(parseBusinessesCsv(text, businesses));
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
    for (const business of result.businesses) addBusiness(business);
    setImported(result.businesses.length);
    setResult(null);
    setPasted("");
  }

  function downloadTemplate() {
    const blob = new Blob([`﻿${BUSINESS_CSV_TEMPLATE}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "avena-modelo-empresas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const unclaimed = businesses.filter((b) => b.claimStatus === "nao-reivindicada");
  const wanted = wantedDestinations(wishlist, businesses);
  const unserved = wanted.filter((w) => w.partners === 0);

  return (
    <>
      <h2 className="timeline-title">Onde os viajantes querem ir</h2>
      <p className="muted">
        Vem das listas de “Quero fazer”. Cidade com desejo e sem parceiro é
        demanda que já existe e ninguém para atender — a melhor lista de
        prospecção que a plataforma consegue produzir sozinha.
      </p>
      {wanted.length === 0 ? (
        <p className="muted">
          Ninguém adicionou destinos à lista de desejos ainda.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cidade</th>
                <th>Desejos</th>
                <th>Parceiros</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {wanted.map((w) => (
                <tr key={w.city}>
                  <td>
                    {w.city}
                    {w.state ? `, ${w.state}` : ""}
                  </td>
                  <td>{w.wishes}</td>
                  <td>{w.partners}</td>
                  <td>
                    {w.partners === 0 ? (
                      <span className="admin-flag">Sem parceiro</span>
                    ) : (
                      <span className="muted">atendida</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unserved.length > 0 && (
        <p className="muted">
          {unserved.length === 1
            ? "1 cidade com procura e nenhum parceiro."
            : `${unserved.length} cidades com procura e nenhum parceiro.`}{" "}
          Comece por elas.
        </p>
      )}

      <h2 className="timeline-title">Cadastrar empresas em lote</h2>
      <p className="muted">
        Use para montar o catálogo de uma cidade antes de ter agência cadastrada.
        Os perfis criados aqui aparecem na busca marcados como{" "}
        <strong>ainda não reivindicados</strong> e não aceitam reserva pelo app —
        o viajante é orientado a falar direto com a agência até ela assumir o
        perfil e conectar o recebimento.
      </p>
      <p className="muted">
        Cadastre apenas empresas que autorizaram, e use descrição escrita por
        você. Copiar texto e foto do site da agência sem permissão é violação de
        direito autoral.
      </p>

      <div className="import-tours">
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
            aria-label="Enviar arquivo CSV de empresas"
          />
        </div>

        <label>
          Ou cole as linhas da sua planilha aqui
          <textarea
            rows={4}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"Nome;Tipo;Cidade;Estado;E-mail\nMar Aberto;Agência;Arraial do Cabo;RJ;contato@maraberto.com.br"}
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
              ? "1 empresa cadastrada."
              : `${imported} empresas cadastradas.`}{" "}
            Agora importe os passeios de cada uma, abaixo.
          </p>
        )}

        {result && (
          <div className="import-preview">
            <h4>
              {result.businesses.length === 1
                ? "1 empresa pronta para cadastrar"
                : `${result.businesses.length} empresas prontas para cadastrar`}
            </h4>

            {result.businesses.length > 0 && (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Tipo</th>
                      <th>Cidade</th>
                      <th>E-mail</th>
                      <th>Cadastur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.businesses.map((b) => (
                      <tr key={b.id}>
                        <td>{b.name}</td>
                        <td>{b.type}</td>
                        <td>
                          {b.city}
                          {b.state ? `, ${b.state}` : ""}
                        </td>
                        <td>{b.email || "—"}</td>
                        <td>{b.cadastur || "—"}</td>
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
              {result.businesses.length > 0 && (
                <button type="button" className="btn-primary" onClick={confirmImport}>
                  Cadastrar {result.businesses.length}{" "}
                  {result.businesses.length === 1 ? "empresa" : "empresas"}
                </button>
              )}
              <button type="button" className="btn-outline" onClick={() => setResult(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <h2 className="timeline-title">Importar passeios de uma empresa</h2>
      <label className="admin-select">
        Empresa
        <select value={tourTarget} onChange={(e) => setTourTarget(e.target.value)}>
          <option value="">Escolha uma empresa</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.city}
              {b.claimStatus === "nao-reivindicada" ? " (não reivindicada)" : ""}
            </option>
          ))}
        </select>
      </label>

      {tourTarget && <ImportTours businessId={tourTarget} />}

      <h2 className="timeline-title">
        {unclaimed.length}{" "}
        {unclaimed.length === 1
          ? "empresa aguardando ser reivindicada"
          : "empresas aguardando serem reivindicadas"}
      </h2>
      <p className="muted">
        Estas foram cadastradas pela Avena. Enquanto a agência não assumir o
        perfil e conectar o recebimento, elas aparecem na busca sem botão de
        reserva.
      </p>
      <div className="timeline">
        {unclaimed.map((b) => (
          <div key={b.id} className="booking-card">
            <div className="timeline-card-title">{b.name}</div>
            <div className="muted">
              {b.type} · {b.city}
              {b.state ? `, ${b.state}` : ""} · {(b.tours ?? []).length} passeios
            </div>
            <div className="muted">{b.email || "sem e-mail cadastrado"}</div>
          </div>
        ))}
      </div>
    </>
  );
}
