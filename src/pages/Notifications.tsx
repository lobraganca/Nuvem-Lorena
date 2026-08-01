import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationKind } from "../lib/notifications";
import { useT } from "../i18n";

const kindLabel: Record<NotificationKind, string> = {
  "vaga-liberada": "Vaga",
  "passeio-hoje": "Hoje",
  avaliar: "Avaliação",
  "registrar-memoria": "Memória",
  "reserva-recebida": "Reserva",
};

export function Notifications() {
  const { dismissNotification } = useAvena();
  const notifications = useNotifications();
  const t = useT();

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.back")}
      </Link>
      <h1>{t("notifications.title")}</h1>
      <p className="muted">{t("notifications.subtitle")}</p>

      {notifications.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>{t("notifications.empty")}</p>
      )}

      <div className="timeline" style={{ marginTop: 20 }}>
        {notifications.map((n) => (
          <div key={n.id} className="notification-card">
            <div className="notification-top">
              <span className="business-type-label">{kindLabel[n.kind]}</span>
              <span className="muted">
                {new Date(n.date).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="timeline-card-title">{n.title}</div>
            <p className="muted">{n.body}</p>
            <div className="chip-row">
              <Link to={n.actionTo} className="btn-primary">
                {n.actionLabel}
              </Link>
              <button
                type="button"
                className="btn-outline"
                onClick={() => dismissNotification(n.id)}
              >
                {t("notifications.dismiss")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
