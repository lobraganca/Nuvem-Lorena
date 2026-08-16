import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { InstalarApp } from "./InstalarApp";
import { PuxarParaAtualizar } from "./PuxarParaAtualizar";
import { AvisoDeVersao } from "./AvisoDeVersao";
import { useAuth } from "../lib/useAuth";
import { isAdmin } from "../lib/admin";
import { useOnlineCount } from "../lib/presence";
import { MarcaProcuro } from "./MarcaProcuro";

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

  return (
    <header className="container header" ref={ref}>
      <span className="header-marca">
        <Logo size="md" />
        {/* A tela de escolha ("quero contratar" / "quero anunciar") só
            aparecia uma vez por aparelho e, depois disso, só tinha um
            caminho de volta — Perfil → Rever apresentação. Este botão é o
            atalho: fica ao lado da marca, em qualquer tela (ela mesma se
            esconde por estar em /inicio, ver isWelcome em AppShell). */}
        <Link to="/inicio" className="btn-tela-inicial" title="Tela inicial" aria-label="Tela inicial">
          <IconCasa />
        </Link>
      </span>
      <span className="header-acoes">
        {/* Quantas pessoas estão no app agora, no topo de todas as telas.
            Estava só na busca e na tela de início, que são as duas primeiras
            — quem já tinha entrado num cadastro ou no painel deixava de ver.

            É contagem real (Presence do Supabase), e por isso some quando
            não há ninguém além de quem está lendo: um "1 on-line" fixo, que
            é sempre a própria pessoa, não informa nada; e número inventado
            que sobe sozinho seria publicidade enganosa (CDC art. 37).

            Aqui em cima vai a forma curta — o cabeçalho divide a linha com
            a marca e o botão de instalar, e no celular não cabe "pessoas
            navegando agora". A frase inteira fica no title, para quem
            passar o mouse ou usar leitor de tela. */}
        {online !== null && online > 0 && (
          <span
            className="online-pill online-pill-topo"
            title={online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
            aria-label={online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
          >
            <span className="online-dot" aria-hidden="true" />
            {online}
            {/* A palavra some abaixo de 420px e fica só o número com o
                ponto verde. Com ela, o botão de instalar era empurrado
                para fora da tela no celular — e escolher entre mostrar o
                contador e mostrar o botão é uma escolha que não precisa
                existir. Quem usa leitor de tela ouve a frase inteira pelo
                aria-label. */}
            <span className="online-pill-texto">&nbsp;on-line</span>
          </span>
        )}
        {/* Ao lado da marca, em todas as telas: some sozinho quando o app já
            está instalado ou quando o navegador não sabe instalar. */}
        <InstalarApp variante="cabecalho" />
      </span>
    </header>
  );
}

/**
 * Shell mobile-first: header simples com a logo, conteúdo da página e uma
 * barra de navegação fixa no rodapé com 5 itens, espelhando o padrão da
 * referência (item ativo destacado em dourado, demais em cinza). Some em
 * telas largas (ver media query em theme.css).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let active = true;
    isAdmin(user.id).then((v) => {
      if (active) setAdmin(v);
    });
    return () => {
      active = false;
    };
  }, [user]);

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

  // A tela de início vem antes de qualquer escolha: mostrar a barra de
  // navegação ali seria oferecer cinco caminhos justamente na tela cujo
  // trabalho é perguntar qual deles a pessoa quer.
  const isWelcome = path === "/inicio";

  return (
    <>
      <PuxarParaAtualizar />
      <AvisoDeVersao />
      {!isWelcome && <Header />}
      {!isWelcome && <BotaoFechar />}
      <div className={isWelcome ? undefined : "app-content"}>{children}</div>
      {isWelcome ? null : (
      <nav className={`bottom-nav${admin ? " com-admin" : ""}`}>
        {/* Voltar em primeiro, à esquerda: é onde o dedo já procura e é a
            ordem de leitura. Botão e não Link, porque o destino não é uma
            tela fixa — é a anterior, qualquer que tenha sido. */}
        {/* Espaço vazio, e só na barra de quem administra.

            O botão do meio fica centrado porque tem o mesmo número de
            itens dos dois lados. Com cinco itens isso acontece sozinho;
            com o de administração são seis, sobra um à direita, e o
            círculo escorrega 30px para a esquerda — foi o que a dona viu
            no próprio celular, e o que fez o botão parecer fora do lugar
            mesmo depois de colado na barra.

            Uma coluna vazia à esquerda reequilibra a conta sem tirar nada
            de ninguém: três de um lado, três do outro, e o círculo volta
            ao meio exato. */}
        {admin && <span className="bottom-nav-espaco" aria-hidden="true" />}
        <BotaoVoltar />
        {/* Cor própria: é o único item da barra que leva a algo pago, e
            distinguir isso do resto é honestidade, não enfeite. Quem toca
            ali sabe, antes de tocar, que vai ver publicidade. */}
        <NavItem
          to="/anuncios"
          label="Anúncios"
          icon={<IconMegafone />}
          active={path.startsWith("/anuncios")}
          destaque
        />
        {/* A busca no meio, num círculo que sobe acima da barra.
            É a ação principal do app e estava indistinguível das outras
            quatro — a mesma lupa cinza do mesmo tamanho, disputando atenção
            com "Anúncios" e "Painel", que quase ninguém abre. O destaque
            aqui não é enfeite copiado de outro aplicativo: é dizer, sem
            texto, qual das cinco a pessoa veio fazer.
            Continua sendo o terceiro item com ou sem a administração —
            com seis não existe meio exato, e o polegar procura pela
            posição, não pela contagem. */}
        <NavItem
          to="/"
          label="Buscar"
          icon={<MarcaProcuro />}
          active={path === "/"}
          centro
        />
        <NavItem
          to="/painel"
          label="Painel"
          icon={<IconBriefcase />}
          active={path.startsWith("/painel")}
          tour="nav-painel"
        />
        <NavItem
          to={user ? "/perfil" : "/login"}
          label="Perfil"
          icon={<IconUser />}
          active={path.startsWith("/perfil") || path === "/login"}
          tour="nav-favoritos"
        />
        {/* Por último, e só para quem é administração: assim as posições
            de Buscar, Anúncios e Painel são as mesmas para todo mundo, e
            o dedo não precisa reaprender a barra ao entrar na conta. */}
        {admin && (
          <NavItem to="/admin" label="Admin" icon={<IconFlag />} active={path.startsWith("/admin")} />
        )}
      </nav>
      )}
    </>
  );
}
