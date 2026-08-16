import { useNavigate, Link } from "react-router-dom";
import { LogoMark } from "../components/Logo";
import { markWelcomeSeen, requestTour } from "../lib/onboarding";
import { InstalarApp } from "../components/InstalarApp";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { useOnlineCount } from "../lib/presence";
import { useEffect, useState } from "react";
import { getEstatisticasPublicas, registrarVisita, type EstatisticasPublicas } from "../lib/estatisticas";
import { useContagemAnimada } from "../lib/useContagemAnimada";
import { useCidadeAproximada } from "../lib/geolocalizacao";
import { getBannersBoasVindas } from "../lib/banners";
import { CardPatrocinado } from "../components/CardPatrocinado";
import { EspacoLivre } from "../components/EspacoLivre";
import type { Banner } from "../types/domain";

const ATUALIZA_ESTATISTICAS_MS = 25_000;

const FEATURES = [
  {
    title: "Tem gente boa aqui do lado",
    text: "Encanador, eletricista, professor particular, manicure — de autônomos a empresas da sua região, num lugar só.",
  },
  {
    title: "Quem já chamou conta como foi",
    /* O CPF saiu do app na migration 0033 — guardá-lo para liberar um
       comentário era coleta excessiva, e ele nunca foi conferido contra
       coisa nenhuma. Esta frase ficou para trás e passou a mentir na pior
       direção possível: prometia a quem lê um rigor que não existe, e
       avisava quem ia avaliar que precisaria de um documento que o app não
       pede. O que de fato distingue uma avaliação hoje é a etiqueta de
       quem chamou pelo app, calculada no servidor. */
    text: "Quem avalia precisa ter conta, e quem chamou pelo app ganha uma etiqueta na avaliação. Em vez de escrever um texto, a pessoa toca em estrelas e etiquetas — leva segundos.",
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
    text: "Quem se cadastra aqui é vizinho, não uma empresa de fora. Avaliação boa vira trabalho; crítica, quando precisa existir, vem específica e sem humilhação.",
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
  const cidade = useCidadeAproximada();
  const [bannersLocais, setBannersLocais] = useState<Banner[]>([]);
  /* Sem isto, a lista vazia do primeiro instante é indistinguível de "não
     há banner vendido", e o convite "Apareça aqui" piscaria por cima do
     espaço de quem pagou. */
  const [bannersCarregando, setBannersCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setBannersCarregando(true);
    getBannersBoasVindas(cidade).then((lista) => {
      if (!ativo) return;
      setBannersLocais(lista);
      setBannersCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [cidade]);

  useEffect(() => {
    let ativo = true;
    /* Conta a visita ANTES da primeira leitura, para quem está abrindo o
       app já se ver no número. Sem `await`: se falhar, a tela não muda —
       um contador não pode atrasar nem quebrar a abertura do app. */
    void registrarVisita();

    function buscar() {
      getEstatisticasPublicas().then((s) => {
        if (ativo) setStats(s);
      });
    }
    buscar();

    /* Só refaz a busca com a aba visível — atualizar em segundo plano
       gastaria requisição por um número que ninguém está olhando, e é
       o mesmo cuidado já tomado com o aviso de atualização do app. */
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") buscar();
    }, ATUALIZA_ESTATISTICAS_MS);

    function aoVoltar() {
      if (document.visibilityState === "visible") buscar();
    }
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  /* Sobrou um número na abertura, e é o de visitas. "Avaliações",
     "visitas a cadastros" e, agora, "profissionais cadastrados" saíram —
     este último porque enquanto o app é novo ele lê contra o próprio app:
     um total baixo numa cidade inteira soa como lugar vazio para quem
     está decidindo se vale procurar aqui. */
  const visitasAppAnimado = useContagemAnimada(stats?.visitasApp ?? 0);
  const visitasHojeAnimado = useContagemAnimada(stats?.visitasHoje ?? 0);

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
      {/* No topo da página, como nas demais telas.
          Aqui não há cabeçalho (ver isWelcome em AppShell), então a pílula
          precisa de uma linha própria — no meio do bloco de abertura ela
          ficava abaixo da logo e do texto, que é o oposto de "no topo".

          Contagem real (Presence do Supabase), a mesma das outras telas. Só
          aparece quando há alguém de verdade: número fabricado que sobe e
          desce sozinho é publicidade enganosa (CDC art. 37), e ser
          descoberto custa mais confiança do que qualquer aparência de
          movimento vale. */}
      <div className="welcome-topo">
        {online !== null && online > 0 && (
          <p className="online-pill">
            <span className="online-dot" aria-hidden="true" />
            {online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
          </p>
        )}
        {/* As visitas saíram daqui e viraram o cartão grande, abaixo da
            marca. Nos dois lugares ao mesmo tempo, o mesmo número aparecia
            duas vezes na mesma tela. */}
      </div>

      <section className="welcome-hero">
        <LogoMark />
        <p className="welcome-tagline">
          Encontre quem faz, aqui perto, com a opinião de quem já contratou.
        </p>
        {/* O "é grátis" saiu daqui e foi para dentro do botão "Cadastre-se".
            Como linha própria no meio da abertura, ele respondia uma
            pergunta que ninguém tinha feito ainda — a pessoa lê "o cadastro
            é grátis" antes de saber que existe cadastro. Colado ao botão,
            chega no instante em que a dúvida aparece, que é na hora de
            decidir tocar. */}
        {/* Visitas ao app, no lugar de "profissionais cadastrados".

            Os dois são números reais, mas dizem coisas diferentes para
            quem acabou de chegar. A contagem de cadastrados é a mais fácil
            de ler contra o app enquanto ele é novo: "18 profissionais"
            numa cidade inteira soa como lugar vazio, justamente para quem
            está decidindo se vale procurar aqui. As visitas são
            cumulativas — só sobem, e falam de movimento em vez de estoque.

            Contagem real, uma por sessão do navegador (ver
            registrarVisita). Escondida no zero: "0 visitas" na primeira
            tela é a única informação que o app consegue dar contra si
            mesmo sem ser verdade útil, porque quem está lendo já é a
            visita número um. */}
        {stats && stats.visitasApp > 0 && (
          <div className="welcome-stats">
            <div className="welcome-stat-card">
              <strong>{visitasAppAnimado}</strong>
              <span>{stats.visitasApp === 1 ? "visita ao app" : "visitas ao app"}</span>
            </div>
            {/* O de hoje só aparece quando há visita hoje — e some sozinho
                de madrugada, quando o dia vira e a contagem volta a zero.
                É de propósito: um "0 hoje" ao lado de um total grande diz
                que o app está parado, que é o contrário do que o par de
                números existe para mostrar.

                Também é o que segura o período entre publicar isto e
                rodar a migration 0051 no banco: sem a função, o número
                vem zero e o cartão simplesmente não aparece. */}
            {stats.visitasHoje > 0 && (
              <div className="welcome-stat-card">
                <strong>{visitasHojeAnimado}</strong>
                <span>{stats.visitasHoje === 1 ? "visita hoje" : "visitas hoje"}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* A escolha vem antes de qualquer explicação: quem abriu o app já sabe
          se quer contratar ou ser encontrado, e fazer essa pessoa rolar por
          quatro cartões de texto para chegar ao botão é atrapalhar. Quem não
          sabe continua rolando e encontra a explicação logo abaixo. */}
      <section className="welcome-choice">
        <button type="button" className="welcome-choice-btn welcome-choice-primary" onClick={escolherCliente}>
          <span className="welcome-choice-label">Encontre um profissional</span>
          <span className="welcome-choice-hint">Estou precisando de um serviço</span>
        </button>

        <button type="button" className="welcome-choice-btn" onClick={escolherProfissional}>
          <span className="welcome-choice-label">
            Cadastre-se <span className="welcome-choice-gratis">grátis</span>
          </span>
          <span className="welcome-choice-hint">Trabalho com isso e quero aparecer</span>
        </button>
      </section>

      {/* Depois da escolha, nunca antes: instalar é útil para quem já decidiu
          ficar, e pedir isso na primeira tela é pedir compromisso a quem
          ainda não viu nada. */}
      <InstalarApp variante="faixa" />

      <section className="welcome-features">
        {FEATURES.map((f) => (
          <div className="card welcome-feature-card" key={f.title}>
            <h3 style={{ margin: "0 0 6px" }}>{f.title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {f.text}
            </p>
          </div>
        ))}

        {/* Os lugares vendidos fecham a lista, depois das explicações.
            Já estiveram no meio (cortavam a leitura, e na grade de quatro
            colunas caíam num buraco qualquer da fileira) e na frente (a
            primeira coisa da tela virava cadastro). Aqui a tela apresenta o
            app primeiro e só então mostra quem pagou para aparecer.

            Vale menos para quem compra do que a primeira posição — quem
            não rolar até o fim não vê —, e isso precisa ser dito na hora de
            vender o espaço. */}
        {bannersLocais.slice(0, 2).map((banner) => (
          <CardPatrocinado key={banner.id} banner={banner} />
        ))}

        {/* Um convite só, e nunca dois: com nenhum lugar vendido, dois
            "Apareça aqui" na primeira tela do app fariam a lista parecer
            mais espaço publicitário do que conteúdo. */}
        {!bannersCarregando && bannersLocais.length === 0 && <EspacoLivre variante="cartao" />}
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
