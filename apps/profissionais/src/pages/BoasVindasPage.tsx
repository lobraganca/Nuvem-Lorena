import { useNavigate, Link } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";
import { LogoMark } from "../components/Logo";
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
  {
    title: "Aqui a gente torce junto",
    text: "Quem anuncia aqui é vizinho, não uma empresa de fora. Avaliação boa vira trabalho; crítica, quando precisa existir, vem específica e sem humilhação.",
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
        <LogoMark />
        <p className="welcome-tagline">
          O profissional certo de {DEFAULT_CITY}, com avaliação de quem já contratou.
        </p>
      </section>

      {/* A escolha vem antes de qualquer explicação: quem abriu o app já sabe
          se quer contratar ou ser encontrado, e fazer essa pessoa rolar por
          quatro cartões de texto para chegar ao botão é atrapalhar. Quem não
          sabe continua rolando e encontra a explicação logo abaixo. */}
      <section className="welcome-choice">
        <button type="button" className="welcome-choice-btn welcome-choice-primary" onClick={escolherCliente}>
          <span className="welcome-choice-label">Quero contratar</span>
          <span className="welcome-choice-hint">Achar quem faz o serviço que preciso</span>
        </button>

        <button type="button" className="welcome-choice-btn" onClick={escolherProfissional}>
          <span className="welcome-choice-label">Quero ser encontrado</span>
          <span className="welcome-choice-hint">Sou profissional ou empresa daqui</span>
        </button>
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
