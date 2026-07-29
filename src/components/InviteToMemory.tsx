import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import type { Experience } from "../types";

/**
 * Invites the people tagged in a memory to add their own photos to it.
 *
 * Delivery needs the backend — there is no account to notify yet — so the
 * invite is recorded and a link is offered to share by any channel, and the
 * UI says plainly that it is pending rather than pretending it was sent.
 */
export function InviteToMemory({ experience }: { experience: Experience }) {
  const { people, inviteToExperience } = useAvena();
  const [copied, setCopied] = useState<string | null>(null);

  const tagged = people.filter((p) => experience.peopleIds.includes(p.id));
  if (tagged.length === 0) return null;

  const invited = new Set(experience.invitedPersonIds ?? []);

  async function share(personId: string, name: string) {
    inviteToExperience(experience.id, personId);
    const url = `${window.location.origin}/experience/${experience.id}`;
    try {
      await navigator.clipboard.writeText(
        `${name}, adicione suas fotos da nossa memória "${experience.title}" no Avena: ${url}`
      );
      setCopied(personId);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard can be blocked; the invite is recorded either way.
      setCopied(personId);
    }
  }

  return (
    <div className="detail-block">
      <h3>Memória compartilhada</h3>
      <p className="muted">
        Convide quem estava com você para somar as fotos dessa pessoa ao mesmo
        dia. Cada um guarda o seu ponto de vista, no mesmo lugar.
      </p>
      <div className="chip-row">
        {tagged.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip ${invited.has(p.id) ? "chip-active" : ""}`}
            onClick={() => share(p.id, p.name)}
          >
            {copied === p.id
              ? "Link copiado"
              : invited.has(p.id)
                ? `${p.name} · convite pendente`
                : `Convidar ${p.name}`}
          </button>
        ))}
      </div>
      {invited.size > 0 && (
        <p className="muted">
          Os convites ficam pendentes até o Avena ter contas conectadas — por
          enquanto, envie o link copiado por onde preferir.
        </p>
      )}
    </div>
  );
}
