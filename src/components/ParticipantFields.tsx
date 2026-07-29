import { documentError, documentTypes, formatCPF } from "../lib/documents";
import type { DocumentType, Participant } from "../types";

export function emptyParticipant(): Participant {
  return { name: "", documentType: "CPF", document: "" };
}

/**
 * Keeps the participant list the same length as the traveler count, preserving
 * whatever was already typed so changing the headcount never wipes the form.
 */
export function resizeParticipants(
  current: Participant[],
  count: number
): Participant[] {
  if (count === current.length) return current;
  if (count < current.length) return current.slice(0, count);
  return [
    ...current,
    ...Array.from({ length: count - current.length }, emptyParticipant),
  ];
}

export function participantsError(participants: Participant[]): string | null {
  for (const [i, p] of participants.entries()) {
    if (!p.name.trim()) return `Informe o nome do participante ${i + 1}`;
    const docError = documentError(p.documentType, p.document);
    if (docError) return `${docError} do participante ${i + 1}`;
  }

  const documents = participants.map((p) => p.document.replace(/\D/g, ""));
  if (new Set(documents).size !== documents.length) {
    return "Há documentos repetidos entre os participantes";
  }
  return null;
}

export function ParticipantFields({
  participants,
  onChange,
}: {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}) {
  function update(index: number, patch: Partial<Participant>) {
    onChange(
      participants.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  return (
    <fieldset>
      <legend>Quem vai participar</legend>
      <p className="muted">
        A agência precisa do nome e documento de cada pessoa para lista de
        embarque, entrada em parques e seguro.
      </p>

      {participants.map((p, i) => {
        const docError = p.document ? documentError(p.documentType, p.document) : null;
        return (
          <div key={i} className="participant-row">
            <div className="participant-index">
              {i === 0 ? "Responsável pela reserva" : `Participante ${i + 1}`}
            </div>
            <label>
              Nome completo
              <input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Como está no documento"
                required
              />
            </label>
            <div className="form-row">
              <label>
                Tipo
                <select
                  value={p.documentType}
                  onChange={(e) =>
                    update(i, {
                      documentType: e.target.value as DocumentType,
                      document: "",
                    })
                  }
                >
                  {documentTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Documento
                <input
                  value={p.document}
                  onChange={(e) =>
                    update(i, {
                      document:
                        p.documentType === "CPF"
                          ? formatCPF(e.target.value)
                          : e.target.value,
                    })
                  }
                  placeholder={p.documentType === "CPF" ? "000.000.000-00" : "Número"}
                  required
                />
                {docError && <span className="participant-error">{docError}</span>}
              </label>
              <label>
                Nascimento (opcional)
                <input
                  type="date"
                  value={p.birthDate ?? ""}
                  onChange={(e) => update(i, { birthDate: e.target.value || undefined })}
                />
              </label>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
