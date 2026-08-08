import { useNavigate, Link } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";
import { markWelcomeSeen, requestTour } from "../lib/onboarding";

const FEATURES = [
  {
    title: "Quem atende perto de você",
    text: `Encanador, eletricista, professor particular, manicure — de autônomos a empresas de ${DEFAULT_CITY} e região, num lugar só.`,
  },
  {
    title: "Avaliação de quem contratou",
    text: "Só quem tem conta e CPF confirmado avalia. Em vez de escrever um texto, a pessoa toca em estrelas e etiquetas — leva segundos.",
  },
  {
    title: "Contato direto",
    text: "Sem intermediário e sem leilão de orçamento: o telefone está ali, e quem tem selo abre o WhatsApp num toque.",
  },
  {
    title: "Selo de verificação",
    text: "Quem assina o selo teve o cadastro conferido (documento, foto e responsável). É um sinal de compromisso — não uma garantia do serviço.",
  },
];

/**
 * Tela de início — primeira coisa que alguém vê ao abrir o app, antes de
 * cair na busca.
 *
 * Existe por um motivo prático: a busca sozinha não conta o que o app é, e
 * as duas pessoas que chegam aqui querem coisas opostas — uma quer contratar,
 * a outra quer ser encontrada. Perguntar isso logo evita que o profissional
 * tenha que descobrir sozinho onde se cadastra.
 */
export function BoasVindasPage() {
  const navigate = useNavigate();

  function escolherCliente() {
    markWelcomeSeen();
    requestTour();
    navigate("/");
  }

  function escolherProfissional() {
    markWelcomeSeen();
    navigate("/painel");
  }

  return (
    <div className="welcome-page">
      <section className="welcome-hero">
        <span className="welcome-mark" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="welcomeGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F4C542" />
                <stop offset="1" stopColor="#C99A3E" />
              </linearGradient>
            </defs>
            <circle cx="10" cy="10" r="7" stroke="url(#welcomeGold)" strokeWidth="2.4" fill="none" />
            <circle cx="10" cy="8.2" r="2" fill="#4FBF9F" />
            <path
              d="M6.3 13c.9-1.7 2.1-2.5 3.7-2.5s2.8.8 3.7 2.5"
              stroke="#4FBF9F"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <line x1="15" y1="15" x2="20" y2="20" stroke="#C99A3E" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="welcome-title">
          <span className="brand">busca</span>
          <span className="city">{DEFAULT_CITY.toUpperCase()}</span>
        </h1>
        <p className="welcome-tagline">
          O profissional certo de {DEFAULT_CITY}, com avaliação de quem já contratou.
        </p>
      </section>

      <section className="welcome-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="card welcome-feature-card">
            <h3 style={{ margin: "0 0 6px" }}>{f.title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {f.text}
            </p>
          </div>
        ))}
      </section>

      <section className="welcome-choice">
        <h2 style={{ marginBottom: 4 }}>Como você quer começar?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Dá para mudar depois — isso só define onde o app abre agora.
        </p>

        <div className="welcome-choice-grid">
          <button type="button" className="card welcome-choice-card" onClick={escolherCliente}>
            <h3>Quero contratar</h3>
            <p className="muted">Procurar quem faz o serviço que preciso.</p>
            <ul>
              <li>Buscar por categoria e cidade</li>
              <li>Ver avaliações e etiquetas</li>
              <li>Chamar no WhatsApp ou salvar nos favoritos</li>
            </ul>
            <span className="welcome-choice-cta">Ver profissionais →</span>
          </button>

          <button type="button" className="card welcome-choice-card" onClick={escolherProfissional}>
            <h3>Quero ser encontrado</h3>
            <p className="muted">Sou profissional ou empresa e quero anunciar.</p>
            <ul>
              <li>Anúncio grátis, como pessoa física ou jurídica</li>
              <li>Selo de verificação e destaque na busca</li>
              <li>Responder às avaliações que receber</li>
            </ul>
            <span className="welcome-choice-cta">Criar meu anúncio →</span>
          </button>
        </div>
      </section>

      <section className="welcome-footnote">
        <p className="muted">
          Em breve nas lojas: por enquanto o Busca {DEFAULT_CITY} funciona pelo navegador e pode ser instalado na
          tela de início do celular.
        </p>
        <p className="muted">
          Somos uma plataforma de busca e divulgação. A contratação e o pagamento são direto entre você e o
          profissional — veja os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </section>
    </div>
  );
}
