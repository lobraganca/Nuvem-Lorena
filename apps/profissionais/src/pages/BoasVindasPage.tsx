import { useNavigate, Link } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";
import { LogoMark } from "../components/Logo";
import { markWelcomeSeen, requestTour } from "../lib/onboarding";
import { InstalarApp } from "../components/InstalarApp";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { useOnlineCount } from "../lib/presence";
import { useEffect, useState } from "react";
import { getEstatisticasPublicas, type EstatisticasPublicas } from "../lib/estatisticas";

const FEATURES = [
  {
    title: "Tem gente boa aqui do lado",
    text: `Encanador, eletricista, professor particular, manicure — de autônomos a empresas de ${DEFAULT_CITY} e região, num lugar só.`,
  },
  {
    title: "Quem já chamou conta como foi",
    text: "Só quem tem conta e CPF confirmado avalia. Em vez de escrever um texto, a pessoa toca em estrelas e etiquetas — leva segundos.",
  },
  {
    title: "Fale direto com a pessoa",
    text: "Sem intermediário e sem leilão de orçamento: o contato está ali, é só chamar.",
  },
  {
    title: "Conta premium",
    text: "Quem assina tem o botão de WhatsApp direto e recebe pedidos de contato pelo app. É um plano pago, não uma avaliação nossa — quem diz se o trabalho é bom são as avaliações de quem contratou.",
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
  useTituloDaPagina("Bem-vindo");
  const navigate = useNavigate();
  const online = useOnlineCount();
  const [stats, setStats] = useState<EstatisticasPublicas | null>(null);

  useEffect(() => {
    getEstatisticasPublicas().then(setStats);
  }, []);

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
          Encontre quem faz, aqui perto, com a opinião de quem já contratou.
        </p>
        {/* Mesmo contador real da Home (Presence do Supabase, sem dado
            inventado). Só aparece quando há alguém de verdade — número
            fabricado que sobe e desce sozinho é publicidade enganosa
            (CDC art. 37), e descoberta custa mais confiança do que
            qualquer aparência de movimento vale. */}
        {online !== null && online > 0 && (
          <p className="online-pill">
            <span className="online-dot" aria-hidden="true" />
            {online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
          </p>
        )}
        {/* Números reais, contados nesta hora — nenhum deles é estimativa
            nem número redondo escolhido para impressionar. Aparecem do
            jeito que estiverem, mesmo baixos: um número pequeno mas
            verdadeiro erra menos do que um alto e inventado. */}
        {stats && (
          <div className="welcome-stats">
            <div>
              <strong>{stats.profissionais}</strong>
              <span>{stats.profissionais === 1 ? "profissional cadastrado" : "profissionais cadastrados"}</span>
            </div>
            <div>
              <strong>{stats.avaliacoes}</strong>
              <span>{stats.avaliacoes === 1 ? "avaliação" : "avaliações"}</span>
            </div>
            <div>
              <strong>{stats.visitas}</strong>
              <span>{stats.visitas === 1 ? "visita a anúncio" : "visitas a anúncios"}</span>
            </div>
          </div>
        )}
      </section>

      {/* A escolha vem antes de qualquer explicação: quem abriu o app já sabe
          se quer contratar ou ser encontrado, e fazer essa pessoa rolar por
          quatro cartões de texto para chegar ao botão é atrapalhar. Quem não
          sabe continua rolando e encontra a explicação logo abaixo. */}
      <section className="welcome-choice">
        <button type="button" className="welcome-choice-btn welcome-choice-primary" onClick={escolherCliente}>
          <span className="welcome-choice-label">Quero contratar alguém</span>
          <span className="welcome-choice-hint">Estou precisando de um serviço</span>
        </button>

        <button type="button" className="welcome-choice-btn" onClick={escolherProfissional}>
          <span className="welcome-choice-label">Quero ser encontrado</span>
          <span className="welcome-choice-hint">Trabalho com isso e quero aparecer</span>
        </button>
      </section>

      {/* Depois da escolha, nunca antes: instalar é útil para quem já decidiu
          ficar, e pedir isso na primeira tela é pedir compromisso a quem
          ainda não viu nada. */}
      <InstalarApp variante="faixa" />

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
          Somos uma plataforma de busca e divulgação. A contratação e o pagamento são direto entre você e o
          profissional — veja os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </section>
    </div>
  );
}
