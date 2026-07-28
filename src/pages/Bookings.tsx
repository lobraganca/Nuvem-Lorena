import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

export function Bookings() {
  const { bookings } = useAvena();
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Voltar ao mapa
      </Link>
      <h1>Minhas reservas</h1>

      {sorted.length === 0 && (
        <p className="muted">
          Nenhuma reserva ainda. Explore os{" "}
          <Link to="/destination">destinos</Link> e feche passeios direto pelo app.
        </p>
      )}

      <div className="timeline">
        {sorted.map((b) => (
          <div key={b.id} className="booking-card">
            <div className="timeline-card-title">{b.tourTitle}</div>
            <div className="muted">
              {b.businessName} · {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
              {b.travelers} {b.travelers === 1 ? "pessoa" : "pessoas"}
            </div>
            <div className="booking-breakdown">
              <div>
                Total pago <strong>R$ {b.totalPrice.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="muted">
                Taxa de serviço Avena ({Math.round(b.commissionRate * 100)}%): R${" "}
                {b.commissionAmount.toLocaleString("pt-BR")}
              </div>
              <div className="muted">
                {b.businessName} recebeu: R$ {b.businessPayout.toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
