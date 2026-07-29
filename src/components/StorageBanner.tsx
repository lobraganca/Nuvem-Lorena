import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useT } from "../i18n";

/**
 * Losing someone's memories silently is the worst thing this app could do, so
 * a failed save is announced instead of swallowed.
 */
export function StorageBanner() {
  const { storageFull } = useAvena();
  const t = useT();

  if (!storageFull) return null;

  return (
    <div className="storage-banner" role="alert">
      {t("storage.full")} <Link to="/meus-dados">{t("storage.open")}</Link>
    </div>
  );
}
