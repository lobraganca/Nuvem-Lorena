import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import avenaLogo from "../assets/avena-logo-wordmark.png";
import { TrendingSection } from "../components/TrendingSection";
import { PromotedTours } from "../components/PromotedTours";

const FEATURES = [
  { title: "Mapa afetivo", text: "Cada pin é uma história vivida — viagens, trilhas, praias, cachoeiras e muito mais." },
  { title: "Pessoas", text: "Veja tudo o que você já viveu com cada pessoa: cidades, trilhas, primeiras vezes." },
  { title: "Coleções", text: "Estados brasileiros, regiões, cachoeiras e praias — acompanhe seu progresso." },
  { title: "Passeios e guias", text: "Descubra agências, guias e restaurantes verificados no seu destino." },
];

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
    <div className="landing-page">
      <section className="landing-hero">
        <img src={avenaLogo} alt="Avena" className="landing-logo" />
        <div className="landing-hero-badge">Feito para o turismo do Brasil</div>
        <p className="landing-tagline">
          Um mapa afetivo para colecionar as experiências, pessoas e lugares que
          você viveu pelo Brasil.
        </p>
      </section>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <h3>{f.title}</h3>
            <p className="muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="page page-wide">
        <PromotedTours />
        <TrendingSection />
      </section>

      <section className="page page-wide welcome-page">
        <h2>Como você quer usar o Avena?</h2>
        <p className="muted">Escolha o tipo de conta para começar.</p>

        <div className="account-type-grid">
          <button type="button" className="account-type-card" onClick={chooseTurista}>
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
      </section>
    </div>
  );
}
