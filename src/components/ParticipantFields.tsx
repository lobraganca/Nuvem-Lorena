import { documentError, documentTypes, formatCPF } from "../lib/documents";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { DocumentType, Participant } from "../types";

/** A validation failure, as a key plus the participant it refers to. */
export interface ParticipantsError {
  key: TranslationKey;
  index: number;
}

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

export function participantsError(
  participants: Participant[]
): ParticipantsError | null {
  for (const [i, p] of participants.entries()) {
    if (!p.name.trim()) return { key: "participants.nameRequired", index: i + 1 };
    const docError = documentError(p.documentType, p.document);
    if (docError) return { key: docError, index: i + 1 };
  }

  const documents = participants.map((p) => p.document.replace(/\D/g, ""));
  if (new Set(documents).size !== documents.length) {
    return { key: "participants.duplicateDocs", index: 0 };
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
  const t = useT();

  function update(index: number, patch: Partial<Participant>) {
    onChange(
      participants.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  return (
    <fieldset>
      <legend>{t("booking.participants")}</legend>
      <p className="muted">{t("booking.participantsWhy")}</p>

      {participants.map((p, i) => {
        const docError = p.document ? documentError(p.documentType, p.document) : null;
        return (
          <div key={i} className="participant-row">
            <div className="participant-index">
              {i === 0
                ? t("participants.leadBooker")
                : t("participants.number", { n: i + 1 })}
            </div>
            <label>
              {t("participants.fullName")}
              <input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={t("participants.asOnDocument")}
                required
              />
            </label>
            <div className="form-row">
              <label>
                {t("participants.docType")}
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
                {t("participants.document")}
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
                  placeholder={p.documentType === "CPF" ? "000.000.000-00" : t("participants.docNumber")}
                  required
                />
                {docError && <span className="participant-error">{t(docError)}</span>}
              </label>
              <label>
                {t("participants.birthDate")}
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
