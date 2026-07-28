import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationKind } from "../lib/notifications";

const kindLabel: Record<NotificationKind, string> = {
  "passeio-hoje": "Hoje",
  avaliar: "Avaliação",
  "registrar-memoria": "Memória",
};

export function Notifications() {
  const { dismissNotification } = useAvena();
  const notifications = useNotifications();

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar
      </Link>
      <h1>Notificações</h1>
      <p className="muted">
        O Avena avisa quando um passeio acontece, quando é hora de avaliar quem
        te atendeu e quando vale registrar a memória no seu mapa.
      </p>

      {notifications.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>
          Nenhuma notificação por enquanto. Assim que um passeio seu terminar,
          ele aparece aqui.
        </p>
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
                Dispensar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
