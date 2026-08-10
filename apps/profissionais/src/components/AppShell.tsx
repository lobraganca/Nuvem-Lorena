import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { InstalarApp } from "./InstalarApp";
import { PuxarParaAtualizar } from "./PuxarParaAtualizar";
import { AvisoDeVersao } from "./AvisoDeVersao";
import { useAuth } from "../lib/useAuth";
import { isAdmin } from "../lib/admin";
import { useOnlineCount } from "../lib/presence";

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

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
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  /** Marca este item como alvo de um passo do tour de primeiro acesso. */
  tour?: string;
}) {
  /* Só o ícone, como no Instagram: o rótulo continua no HTML para quem usa
     leitor de tela e para o `title`, mas sai da tela. Numa barra de cinco
     colunas em celular estreito, o texto obrigava a fonte a encolher até o
     tamanho em que ninguém lê mesmo — e quem já usou qualquer aplicativo
     reconhece a lupa, o coração e a pessoinha sem legenda. */
  return (
    <Link
      to={to}
      className={`bottom-nav-item${active ? " active" : ""}`}
      data-tour={tour}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="apenas-leitor-de-tela">{label}</span>
    </Link>
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
  return (
    <header className="container header">
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
            — quem já tinha entrado num anúncio ou no painel deixava de ver.

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
  const thirdItem = admin
    ? { to: "/admin", label: "Admin", icon: <IconFlag /> }
    : { to: "/anuncios", label: "Anúncios", icon: <IconMegafone /> };

  // A tela de início vem antes de qualquer escolha: mostrar a barra de
  // navegação ali seria oferecer cinco caminhos justamente na tela cujo
  // trabalho é perguntar qual deles a pessoa quer.
  const isWelcome = path === "/inicio";

  return (
    <>
      <PuxarParaAtualizar />
      <AvisoDeVersao />
      {!isWelcome && <Header />}
      <div className={isWelcome ? undefined : "app-content"}>{children}</div>
      {isWelcome ? null : (
      <nav className="bottom-nav">
        <NavItem to="/" label="Buscar" icon={<IconSearch />} active={path === "/"} />
        <NavItem
          to="/favoritos"
          label="Favoritos"
          icon={<IconHeart />}
          active={path.startsWith("/favoritos")}
          tour="nav-favoritos"
        />
        <NavItem to={thirdItem.to} label={thirdItem.label} icon={thirdItem.icon} active={path.startsWith(thirdItem.to)} />
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
        />
      </nav>
      )}
    </>
  );
}
