import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { effectiveStatus } from "../lib/bookingStatus";
import { formatBRL } from "../lib/money";
import { SettingsRow, rowIcon } from "../components/SettingsRow";

const today = new Date().toISOString().slice(0, 10);

/**
 * O painel: a porta, e não o depósito.
 *
 * Ele tinha virado uma página só com tudo dentro — os números, os dados da
 * empresa, o mapa do ponto de encontro, a lista de passeios, a agenda de cada
 * passeio, o formulário de publicar, a importação em massa, o extrato, as
 * avaliações e as reservas. Medido: sete telas e meia de rolagem, cento e oito
 * botões. Ninguém administra nada assim; procura-se o que se veio fazer, não
 * se acha, e desiste-se no meio.
 *
 * Agora ele responde duas perguntas — quem chega e quanto entra — e leva às
 * telas onde cada assunto mora inteiro. Um assunto por tela é o que permite
 * terminar uma tarefa.
 */
export function ProfessionalDashboard() {
  const { user, businesses, bookings, touchBusinessPresence } = useAvena();
  const business = businesses.find((b) => b.id === user.ownBusinessId);

  // Presence is a side effect of actually being here, not a switch.
  useEffect(() => {
    if (!business) return;
    touchBusinessPresence(business.id);
    const timer = window.setInterval(() => touchBusinessPresence(business.id), 60_000);
    return () => window.clearInterval(timer);
  }, [business, touchBusinessPresence]);

  if (!business) {
    return (
      <div className="page">
        <h1>Painel profissional</h1>
        <p className="muted">Você ainda não tem uma empresa cadastrada no Avena.</p>
        <Link to="/business/new?onboarding=1" className="btn-primary">
          Cadastrar minha empresa
        </Link>
      </div>
    );
  }

  const minhas = bookings.filter((b) => b.businessId === business.id);
  const confirmadas = minhas.filter((b) => effectiveStatus(b) === "confirmada");
  const aReceber = confirmadas
    .filter((b) => b.travelDate >= today)
    .reduce((soma, b) => soma + b.businessPayout, 0);

  // Só o que acontece de hoje em diante, e no máximo três: o painel abre para
  // dizer quem chega, não para guardar histórico.
  const proximas = confirmadas
    .filter((b) => b.travelDate >= today)
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate))
    .slice(0, 3);

  const semPreco = (business.tours ?? []).filter((t) => !t.priceFrom).length;
  const semFoto = (business.tours ?? []).filter((t) => !t.photos?.length).length;

  return (
    <div className="page profile-page">
      <div className="business-header">
        <h1>{business.name}</h1>
        <p className="muted">
          {business.type} · {business.city}
          {business.state ? `, ${business.state}` : ""}
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{proximas.length}</div>
          <div className="stat-label">Chegando</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">R$ {formatBRL(aReceber)}</div>
          <div className="stat-label">A receber</div>
        </div>
      </div>

      {/* O que impede de vender, e só isso. Um painel que avisa de tudo não
          avisa de nada. */}
      {(semPreco > 0 || semFoto > 0) && (
        <div className="availability-note availability-none">
          {semPreco > 0 && (
            <>
              {semPreco === 1
                ? "Um passeio sem preço não recebe reservas."
                : `${semPreco} passeios sem preço não recebem reservas.`}{" "}
            </>
          )}
          {semFoto > 0 && (
            <>
              {semFoto === 1 ? "Um passeio está" : `${semFoto} passeios estão`} sem
              foto, e quase ninguém toca neles.
            </>
          )}{" "}
          <Link to="/professional/passeios">Resolver</Link>
        </div>
      )}

      <h2 className="settings-section">Chegando</h2>
      {proximas.length === 0 ? (
        <p className="muted">Nenhuma reserva confirmada por vir.</p>
      ) : (
        <div className="timeline">
          {proximas.map((b) => (
            <Link key={b.id} to="/professional/reservas" className="booking-card">
              <div className="timeline-card-title">{b.tourTitle}</div>
              <div className="muted">
                {new Date(b.travelDate).toLocaleDateString("pt-BR")} · {b.travelers}{" "}
                {b.travelers === 1 ? "pessoa" : "pessoas"}
                {b.participants?.[0]?.name ? ` · ${b.participants[0].name}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="settings-section">Administrar</h2>
      <div className="settings-group-rows">
        <SettingsRow
          to="/professional/passeios"
          icon={rowIcon.map}
          label={`Meus passeios (${(business.tours ?? []).length})`}
        />
        <SettingsRow
          to="/professional/reservas"
          icon={rowIcon.person}
          label={`Reservas (${minhas.length})`}
        />
        <SettingsRow to="/professional/extrato" icon={rowIcon.store} label="Extrato" />
        <SettingsRow
          to="/professional/avaliacoes"
          icon={rowIcon.star}
          label="Avaliações"
        />
      </div>

      <div className="settings-group-rows">
        <SettingsRow to="/anuncios" icon={rowIcon.star} label="Anúncios" />
        <SettingsRow
          to="/professional/empresa"
          icon={rowIcon.store}
          label="Minha empresa"
        />
      </div>

      <div className="settings-group-rows">
        <div className="settings-note">
          Você recebe o preço cheio que anunciou. A taxa de serviço do Avena é
          paga pelo viajante, por cima do valor.
        </div>
      </div>
    </div>
  );
}
