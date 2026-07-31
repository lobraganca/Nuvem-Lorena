import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatPhone,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
} from "../lib/documents";
import { BRAZILIAN_STATES } from "../lib/collections";
import type { LegalDetails, LegalKind } from "../types";

export function emptyLegalDetails(): LegalDetails {
  return {
    kind: "juridica",
    legalName: "",
    document: "",
    cep: "",
    address: "",
    district: "",
    city: "",
    // Empty rather than the first state in the list: a pre-selected "AC" is a
    // wrong answer nobody notices, and it would also swallow the state chosen
    // in the previous step.
    state: "",
    representative: "",
    representativeCpf: "",
    businessEmail: "",
    businessPhone: "",
  };
}

/** The first field that is missing or wrong, in reading order, or null. */
export function legalDetailsError(d: LegalDetails): string | null {
  const company = d.kind === "juridica";
  if (!d.legalName.trim())
    return company ? "Informe a razão social." : "Informe seu nome completo.";
  if (company && !isValidCNPJ(d.document)) return "CNPJ inválido — confira os números.";
  if (!company && !isValidCPF(d.document)) return "CPF inválido — confira os números.";
  if (!isValidCEP(d.cep)) return "CEP incompleto.";
  if (!d.address.trim()) return "Informe o endereço.";
  if (!d.district.trim()) return "Informe o bairro.";
  if (!d.city.trim()) return "Informe a cidade.";
  if (!d.state) return "Escolha o estado.";
  if (!d.representative.trim()) return "Informe o representante legal.";
  if (!isValidCPF(d.representativeCpf)) return "CPF do representante inválido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.businessEmail.trim()))
    return "E-mail comercial inválido.";
  if (!isValidPhone(d.businessPhone)) return "Telefone comercial incompleto.";
  return null;
}

/**
 * The legal side of a partner: who is responsible, and where they are.
 *
 * These are the fields a payment provider asks for before it will pay anyone,
 * and the ones an invoice is tied to. They are collected once, when the
 * business signs up — never on a traveller's phone.
 */
export function LegalDetailsForm({
  value,
  onChange,
}: {
  value: LegalDetails;
  onChange: (next: LegalDetails) => void;
}) {
  const company = value.kind === "juridica";

  function set(patch: Partial<LegalDetails>) {
    onChange({ ...value, ...patch });
  }

  function setKind(kind: LegalKind) {
    // The document belongs to the kind, so switching clears it rather than
    // leaving a CNPJ sitting in a field labelled CPF. The company-only fields
    // go with it, so a person is never saved carrying a trade name whose field
    // they were never shown.
    set({
      kind,
      document: "",
      ...(kind === "fisica" ? { tradeName: undefined, stateRegistration: undefined } : {}),
    });
  }

  return (
    <>
      <div className="legal-toggle">
        <button
          type="button"
          className={`legal-toggle-option ${company ? "legal-toggle-on" : ""}`}
          onClick={() => setKind("juridica")}
          aria-pressed={company}
        >
          Pessoa jurídica
        </button>
        <button
          type="button"
          className={`legal-toggle-option ${!company ? "legal-toggle-on" : ""}`}
          onClick={() => setKind("fisica")}
          aria-pressed={!company}
        >
          Pessoa física
        </button>
      </div>

      <label>
        {company ? "Razão social" : "Nome completo"}
        <input
          value={value.legalName}
          onChange={(e) => set({ legalName: e.target.value })}
          required
        />
      </label>

      <label>
        {company ? "CNPJ" : "CPF"}
        <input
          inputMode="numeric"
          value={value.document}
          onChange={(e) =>
            set({
              document: company
                ? formatCNPJ(e.target.value)
                : formatCPF(e.target.value),
            })
          }
          placeholder={company ? "00.000.000/0000-00" : "000.000.000-00"}
          required
        />
      </label>

      {company && (
        <>
          <label>
            Inscrição estadual (opcional)
            <input
              value={value.stateRegistration ?? ""}
              onChange={(e) => set({ stateRegistration: e.target.value })}
            />
          </label>
          <label>
            Nome fantasia (opcional)
            <input
              value={value.tradeName ?? ""}
              onChange={(e) => set({ tradeName: e.target.value })}
            />
          </label>
        </>
      )}

      <div className="form-row">
        <label>
          CEP
          <input
            inputMode="numeric"
            value={value.cep}
            onChange={(e) => set({ cep: formatCEP(e.target.value) })}
            placeholder="00000-000"
            required
          />
        </label>
        <label>
          Estado
          <select value={value.state} onChange={(e) => set({ state: e.target.value })} required>
            <option value="">UF</option>
            {BRAZILIAN_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Endereço
        <input
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
          required
        />
      </label>

      <div className="form-row">
        <label>
          Complemento (opcional)
          <input
            value={value.addressExtra ?? ""}
            onChange={(e) => set({ addressExtra: e.target.value })}
          />
        </label>
        <label>
          Bairro
          <input
            value={value.district}
            onChange={(e) => set({ district: e.target.value })}
            required
          />
        </label>
      </div>

      <label>
        Cidade
        <input
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          required
        />
      </label>

      <label>
        Representante legal
        <input
          value={value.representative}
          onChange={(e) => set({ representative: e.target.value })}
          required
        />
      </label>

      <label>
        CPF do representante
        <input
          inputMode="numeric"
          value={value.representativeCpf}
          onChange={(e) => set({ representativeCpf: formatCPF(e.target.value) })}
          placeholder="000.000.000-00"
          required
        />
      </label>

      <div className="form-row">
        <label>
          E-mail comercial
          <input
            type="email"
            value={value.businessEmail}
            onChange={(e) => set({ businessEmail: e.target.value })}
            required
          />
        </label>
        <label>
          Telefone comercial
          <input
            inputMode="tel"
            value={value.businessPhone}
            onChange={(e) => set({ businessPhone: formatPhone(e.target.value) })}
            placeholder="(00) 00000-0000"
            required
          />
        </label>
      </div>
    </>
  );
}
