import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { LEGAL_VERSION } from "../content/legal";

/** True when the user already accepted the current version of the documents. */
export function useLegalAccepted(): boolean {
  const { user } = useAvena();
  return user.acceptedLegalVersion === LEGAL_VERSION;
}

/** Records acceptance of the current version. */
export function useAcceptLegal(): () => void {
  const { updateUser } = useAvena();
  return () =>
    updateUser({
      acceptedLegalVersion: LEGAL_VERSION,
      acceptedLegalAt: new Date().toISOString(),
    });
}

/**
 * Consent checkbox shown before any transaction (booking or business
 * registration). Renders nothing once the current version was accepted.
 */
export function LegalAcceptance({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const alreadyAccepted = useLegalAccepted();

  if (alreadyAccepted) return null;

  return (
    <label className="legal-accept">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Li e aceito os{" "}
        <Link to="/termos" target="_blank">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link to="/privacidade" target="_blank">
          Política de Privacidade
        </Link>
        .
      </span>
    </label>
  );
}
