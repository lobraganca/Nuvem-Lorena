import { Link } from "react-router-dom";
import { useT } from "../i18n";

/**
 * Also what an unknown address gets — including /admin on a public build,
 * where the panel does not exist. A blank screen looks like a bug; this does
 * not, and it says nothing about what might be hidden elsewhere.
 */
export function NotFound() {
  const t = useT();

  return (
    <div className="page">
      <h1>{t("notFound.title")}</h1>
      <p className="muted">{t("notFound.text")}</p>
      <Link to="/" className="btn-primary">
        {t("notFound.home")}
      </Link>
    </div>
  );
}
