import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

/**
 * Losing someone's memories silently is the worst thing this app could do, so
 * a failed save is announced instead of swallowed.
 */
export function StorageBanner() {
  const { storageError } = useAvena();
  if (!storageError) return null;

  return (
    <div className="storage-banner" role="alert">
      {storageError} <Link to="/meus-dados">Abrir Meus dados</Link>
    </div>
  );
}
