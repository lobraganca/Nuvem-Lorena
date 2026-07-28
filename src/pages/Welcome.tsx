import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";

export function Welcome() {
  const { updateUser } = useAvena();
  const navigate = useNavigate();

  function chooseTurista() {
    updateUser({ accountType: "turista" });
    navigate("/");
  }

  function chooseProfissional() {
    updateUser({ accountType: "profissional" });
    navigate("/business/new?onboarding=1");
  }

  return (
    <div className="page page-wide welcome-page">
      <h1>Bem-vindo ao Avena</h1>
      <p className="muted">Como você quer usar o app?</p>

      <div className="account-type-grid">
        <button type="button" className="account-type-card" onClick={chooseTurista}>
          <div className="account-type-emoji">🧳</div>
          <h2>Sou turista</h2>
          <p className="muted">
            Colecione suas experiências, monte seu mapa afetivo, converse com
            amigos e reserve passeios direto pelo app.
          </p>
          <ul>
            <li>Registrar experiências e memórias</li>
            <li>Perfil pessoal e coleções</li>
            <li>Reservar passeios e falar com guias</li>
          </ul>
        </button>

        <button type="button" className="account-type-card" onClick={chooseProfissional}>
          <div className="account-type-emoji">🧭</div>
          <h2>Sou profissional</h2>
          <p className="muted">
            Cadastre sua agência, seu trabalho como guia ou restaurante, publique
            passeios e receba reservas de viajantes.
          </p>
          <ul>
            <li>Cadastro de agência, guia ou restaurante</li>
            <li>Publicar passeios do seu destino</li>
            <li>Painel de reservas recebidas e ganhos</li>
          </ul>
        </button>
      </div>
    </div>
  );
}
