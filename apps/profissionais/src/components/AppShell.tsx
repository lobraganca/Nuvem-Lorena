import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { InstalarApp } from "./InstalarApp";
import { PuxarParaAtualizar } from "./PuxarParaAtualizar";
import { AvisoDeVersao } from "./AvisoDeVersao";
import { AvisoSemInternet } from "./AvisoSemInternet";
import { useAuth } from "../lib/useAuth";
import { NavegacaoEi } from "./NavegacaoEi";
import { useOnlineCount } from "../lib/presence";
import { MarcaProcuro } from "./MarcaProcuro";
import { ExigirNumero, exigeNumero } from "./ExigirNumero";
import { CompletarPerfil, exigePerfil } from "./CompletarPerfil";

/* Etiqueta de preço: diz "aqui tem oferta" sem a agressividade do megafone,
   que num app de serviços lê como spam. */
function IconMegafone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 12.6 12 21.2l-8.5-8.5V3.5H12l8.6 8.6a1.4 1.4 0 0 1 0 2Z" />
      <circle cx="7.6" cy="7.6" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}

function IconCasa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" />
    </svg>
  );
}

function NavItem({
  to,
  label,
  icon,
  active,
  tour,
  destaque,
  centro,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  /** Marca este item como alvo de um passo do tour de primeiro acesso. */
  tour?: string;
  /** Item com cor própria — hoje só o de anúncios, que leva a conteúdo pago. */
  destaque?: boolean;
  /** O item do meio, num círculo elevado: a ação principal do app. */
  centro?: boolean;
}) {
  /* Ícone com o nome embaixo.
     Já foi só ícone, pelo argumento de que "todo mundo reconhece a lupa e a
     pessoinha". Vale para a lupa e a pessoinha; não vale para o resto. Uma
     maleta é Painel ou Viagens? Um megafone é Anúncios — ou é aviso? Quem
     não reconhece não pergunta: toca, cai na tela errada e volta, e depois
     de duas vezes deixa de tocar. O nome custa 11 pixels de altura e
     remove a adivinhação. */
  return (
    <Link
      to={to}
      className={`bottom-nav-item${active ? " active" : ""}${destaque ? " bottom-nav-anuncios" : ""}${centro ? " bottom-nav-centro" : ""}`}
      data-tour={tour}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {centro ? <span className="bottom-nav-circulo">{icon}</span> : icon}
      <span className="bottom-nav-rotulo">{label}</span>
    </Link>
  );
}

function IconSeta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Voltar para a tela anterior, na barra de baixo.
 *
 * O app é uma página só que troca de tela por dentro: no celular, o gesto
 * de voltar do sistema funciona, mas o botão do navegador some quando o
 * app está instalado — e aí quem entrou num cadastro pelo terceiro nível de
 * navegação não tinha como recuar sem escolher uma tela na barra, que é
 * outra coisa.
 *
 * Sem histórico (alguém abriu o app direto num cadastro, por um link
 * recebido), voltar não tem para onde ir: nesse caso leva à busca, que é
 * o começo do app, em vez de não fazer nada.
 */
function BotaoVoltar() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="bottom-nav-item"
      title="Voltar"
      aria-label="Voltar para a tela anterior"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/");
      }}
    >
      <IconSeta />
      <span className="bottom-nav-rotulo">Voltar</span>
    </button>
  );
}

/**
 * Fechar, flutuando no alto da tela.
 *
 * "Fechar" tem um limite que o navegador impõe e não dá para contornar:
 * `window.close()` só funciona em janela que o próprio site abriu, ou no
 * app instalado. Numa aba comum ela simplesmente não faz nada.
 *
 * Então o botão tenta fechar de verdade e, se a janela continuar aberta um
 * instante depois, leva para a tela de início — que é o mais perto de
 * "fechar" que existe dentro do app. O que não pode é o toque não
 * responder: botão que não faz nada é pior do que botão que não existe.
 */
function BotaoFechar() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="btn-fechar-pagina"
      title="Fechar"
      aria-label="Fechar"
      onClick={() => {
        window.close();
        // Ainda aberta? Então o navegador recusou (aba comum). Vai para o
        // início em vez de deixar o toque sem resposta.
        window.setTimeout(() => {
          if (!window.closed) navigate("/inicio");
        }, 150);
      }}
    >
      <IconFechar />
    </button>
  );
}

/**
 * Cabeçalho: a marca e o botão de instalar.
 *
 * O "Sair" morava aqui e voltou para o Perfil. A intenção era boa — sair
 * rápido quando se empresta o celular —, mas num app o botão mais visível de
 * todas as telas, escrito "Sair", é lido como "fechar o aplicativo". Quem
 * tocasse esperando fechar perdia a sessão e tinha que entrar de novo. Sair
 * da conta é ação de conta, e conta se mexe no Perfil.
 */
function Header() {
  const online = useOnlineCount();
  const ref = useRef<HTMLElement>(null);

  /* Publica a altura real do cabeçalho numa variável CSS.
     Os chips de grupo da tela inicial também grudam no alto, e precisam
     grudar *abaixo* daqui. Com um número escrito à mão no CSS, ou eles
     passam por baixo da logo ou sobra uma faixa vazia entre os dois — e
     não existe número certo para escrever: a altura muda com a faixa de
     status do iPhone (`safe-area-inset-top`), que só o aparelho conhece.
     Medir e publicar resolve nos dois casos, e o `ResizeObserver` mantém o
     valor certo quando o cabeçalho muda de altura (o contador de pessoas
     on-line aparece e some). */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () =>
      document.documentElement.style.setProperty("--altura-header", `${el.offsetHeight}px`);
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  /* O cabeçalho do Ei: só a marca.
        ─────────────────────────────
        O do procurô tinha, além dela, o botão de casa, o contador de
        "pessoas on-line" e o botão "Instalar App" — três coisas disputando
        a mesma linha num celular de 390px, e foi por isso que a marca com o
        nome ao lado empurrou o botão de instalar para fora da tela.

        A referência que a dona mandou tem só a marca no topo, e o título da
        tela grande logo abaixo, dentro da própria página. Cada coisa que
        saiu daqui foi para onde ela pertence: instalar é item das
        configurações, e voltar ao começo é tocar na marca.

        O contador de on-line saiu inteiro: num app de trabalho, "12 pessoas
        navegando" não ajuda ninguém a decidir nada — no procurô ele servia
        para dar movimento a uma vitrine. */
  return (
    <header className="cabecalho-ei" ref={ref}>
      <Logo size="sm" />
    </header>
  );
}

/**
 * Shell mobile-first: header simples com a logo, conteúdo da página e uma
 * barra de navegação fixa no rodapé com 5 itens, espelhando o padrão da
 * referência (item ativo destacado em dourado, demais em cinza). Some em
 * telas largas (ver media query em theme.css).
 */
/**
 * Põe as barreiras das telas de conta em volta do conteúdo, na ordem certa.
 *
 * Existe como função e não inline porque eram dois ternários aninhados no
 * meio do JSX, e a próxima barreira faria três — o tipo de linha que se lê
 * errado e se edita pior.
 *
 * Cada barreira, desligada ou fora das telas dela, não aparece nem como
 * componente: `exigeNumero`/`exigePerfil` respondem `false` e o `useAuth`
 * lá dentro nem chega a pedir a sessão.
 */
function envolverTelaDeConta(caminho: string, conteudo: ReactNode): ReactNode {
  let saida = conteudo;
  if (exigePerfil(caminho)) saida = <CompletarPerfil>{saida}</CompletarPerfil>;
  if (exigeNumero(caminho)) saida = <ExigirNumero>{saida}</ExigirNumero>;
  return saida;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const path = location.pathname;
  /* O "Guia" saiu da barra e virou "Anúncios".
     
     Não é troca de rótulo: é trocar uma tela que a pessoa abre uma vez na
     vida por uma que ela pode abrir toda semana — e que é o estoque de
     publicidade do app. Na busca cabe um banner por vez, com razão; aqui
     cabem todos, porque é isso que a pessoa veio ver.
     
     O Guia não se perde: continua no Perfil, em "Como funciona", que é onde
     se procura ajuda depois da primeira semana. */
  /* Anúncios deixou de disputar a vaga com Admin.
     Antes os dois dividiam o mesmo lugar, e quem é administração perdia
     o acesso à vitrine de anúncios pela barra — justamente quem mais
     precisa conferir se o que foi vendido está no ar. A vaga sobrou
     porque Favoritos saiu daqui: ele já existe no Perfil ("Meus
     favoritos"), e o coração de salvar continua em cada cartão da busca,
     que é onde a pessoa realmente usa. */

  /* A tela de início esconde o cabeçalho, mas não a barra de baixo.

     O argumento para escondê-la era que aquela tela vem antes de qualquer
     escolha, e oferecer cinco caminhos ali atrapalharia a pergunta que ela
     faz. Só que a tela de início não é mais só a porta de entrada: dá para
     voltar a ela pela casinha do cabeçalho, a qualquer momento, e quem faz
     isso ficava sem saída nenhuma — a única forma de sair era a casinha,
     que desaparece justamente ali. A dona pediu a barra nesta tela por
     isso.

     O cabeçalho continua fora: a marca é o assunto da tela, e repeti-la
     menor no alto só duplicaria. */
  const isWelcome = path === "/inicio";

  return (
    <>
      <PuxarParaAtualizar />
      <AvisoDeVersao />
      {/* Antes do cabeçalho: se não há internet, isso vem antes de qualquer
          coisa que a pessoa possa interpretar como defeito do app. */}
      <AvisoSemInternet />
      {!isWelcome && <Header />}
      {/* O "×" flutuante saiu.
          ─────────────────────
          Era do procurô: uma tela de vitrine que a pessoa abria de um link
          e queria fechar. Num app de trabalho não há o que fechar — as
          telas são destinos da barra de baixo, e sair de uma é ir para
          outra. Ele ainda tapava o canto de cima à direita de toda tela.

          O componente `BotaoFechar` fica no arquivo, sem uso, porque a
          lógica dele (o navegador só deixa fechar aba que o próprio app
          abriu) é conhecimento que custou caro e pode voltar a fazer falta.
          Está comentado lá em cima. */}
      {/* `app-content` também na tela de início: é ele que reserva o espaço
          da barra embaixo. Sem isso, o último botão da apresentação fica
          escondido atrás dela. */}
      {/* As duas barreiras envolvem só as telas de conta. A busca fica de
          fora de propósito: ela funciona sem conta, e é o motivo de o app
          existir.

          A ordem importa. O número vem por fora e o perfil por dentro,
          porque quem confirma o número acaba de dizer qual ele é — e a
          tela de perfil, logo em seguida, já o encontra preenchido. Na
          ordem inversa a pessoa digitaria o telefone, seria mandada
          confirmar o mesmo telefone, e voltaria a um formulário que ela
          já tinha preenchido. */}
      <div className="app-content">
        {envolverTelaDeConta(path, children)}
      </div>
      {/* A barra do procurô saiu inteira.
          ─────────────────────────────────
          Eram cinco itens — Voltar, Anúncios, Buscar, Painel, Perfil — com
          o botão redondo da busca no meio. Essa é a espinha de um app para
          achar um encanador e navegar em publicidade, não de um app de
          trabalho: "Anúncios" leva a banners pagos e "Buscar" era A ação do
          produto antigo.

          A nova é por papel e tem três itens. Ver NavegacaoEi.tsx. */}
      <NavegacaoEi />
    </>
  );
}
