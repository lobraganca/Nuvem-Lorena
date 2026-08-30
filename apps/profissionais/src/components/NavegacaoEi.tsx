import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";

/**
 * A barra de baixo do Ei Itabirito.
 *
 * A que existia era do procurô, e não por descuido: este código É o app do
 * procurô, renomeado. A barra dele oferecia **Anúncios, Buscar, Painel,
 * Perfil** — a espinha de um app para achar um encanador para a sua casa e
 * navegar em publicidade.
 *
 * O Ei Itabirito é outro produto. Quem trabalha quer saber se apareceu vaga;
 * quem contrata quer publicar e conversar com quem respondeu. Nenhuma dessas
 * duas coisas tinha lugar na barra antiga, e é por isso que trocar cor e
 * fonte não resolvia: a diferença não estava no acabamento, estava em quais
 * são os quatro lugares do app.
 *
 * ── Por papel, e não uma barra para todos ────────────────────────────────
 *
 * As duas pessoas que usam o app não compartilham quase nada. Uma barra
 * única precisaria ter os destinos das duas, e aí metade dos itens seria
 * inútil para cada uma — que é exatamente o defeito que a barra antiga
 * tinha ("Anúncios" e "Painel" existiam para quase ninguém).
 *
 *   quem trabalha   Vagas · Meu perfil · Conta
 *   quem contrata   Minhas vagas · Profissionais · Empresa
 *   sem conta       Entrar
 *
 * Três itens, não cinco. O botão redondo do meio saiu junto: ele existia
 * para destacar a busca, que era A ação do procurô. Aqui não há uma ação
 * que domine as outras — há dois lados, cada um com o seu caminho.
 */

type Destino = { to: string; label: string; icone: ReactNode; casa: (p: string) => boolean };

/* Ícones em traço, no peso do Material. Desenhados aqui e não importados de
   uma biblioteca porque são cinco, e uma dependência inteira para cinco
   desenhos é peso que o 4G da cidade paga. */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const IconeVagas = (
  <Svg>
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M3 12h18" />
  </Svg>
);

const IconePessoa = (
  <Svg>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Svg>
);

const IconePessoas = (
  <Svg>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5a6 6 0 0 1 12 0" />
    <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M18 15.2a6 6 0 0 1 3 4.3" />
  </Svg>
);

const IconePredio = (
  <Svg>
    <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h7A1.5 1.5 0 0 1 14 6.5V20" />
    <path d="M14 11h4.5A1.5 1.5 0 0 1 20 12.5V20" />
    <path d="M2.5 20h19" />
    <path d="M7 9h4M7 13h4M17 15h1" />
  </Svg>
);

const IconeEntrar = (
  <Svg>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l4 4-4 4" />
    <path d="M14 12H3.5" />
  </Svg>
);

function destinos(tipo: "professional" | "company" | false | null, temConta: boolean): Destino[] {
  if (!temConta) {
    return [{ to: "/login", label: "Entrar", icone: IconeEntrar, casa: (p) => p === "/login" }];
  }

  if (tipo === "company") {
    return [
      { to: "/painel-empresa", label: "Minhas vagas", icone: IconeVagas,
        casa: (p) => p.startsWith("/painel-empresa") || p.startsWith("/vaga") || p.startsWith("/criar-vaga") },
      { to: "/profissionais", label: "Profissionais", icone: IconePessoas,
        casa: (p) => p.startsWith("/profissionais") },
      { to: "/perfil", label: "Empresa", icone: IconePredio,
        casa: (p) => p.startsWith("/perfil") || p.startsWith("/cadastro-empresa") || p.startsWith("/planos-empresa") },
    ];
  }

  /* Profissional, e também quem entrou e ainda não escolheu o tipo: para
     esse último, a lista de vagas é a tela que explica o app melhor do que
     qualquer texto. */
  return [
    { to: "/vagas-para-mim", label: "Vagas", icone: IconeVagas,
      casa: (p) => p.startsWith("/vagas-para-mim") },
    { to: "/painel", label: "Meu perfil", icone: IconePessoa,
      casa: (p) => p.startsWith("/painel") },
    { to: "/perfil", label: "Conta", icone: IconePredio,
      casa: (p) => p.startsWith("/perfil") },
  ];
}

export function NavegacaoEi() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const tipo = useOnboardingStatus();

  const itens = destinos(tipo, !!user);

  return (
    <nav className="nav-ei" aria-label="Navegação principal">
      {itens.map((d) => {
        const ativo = d.casa(pathname);
        return (
          <Link
            key={d.to}
            to={d.to}
            className={ativo ? "nav-ei-item ativo" : "nav-ei-item"}
            aria-current={ativo ? "page" : undefined}
          >
            {/* A cápsula é um elemento próprio, e não um fundo no item:
                ela precisa envolver SÓ o ícone, com o nome embaixo e fora.
                Um fundo no item inteiro vira um retângulo alto que engole o
                rótulo — o erro clássico de quem copia isto de olho. */}
            <span className="nav-ei-capsula">{d.icone}</span>
            <span className="nav-ei-rotulo">{d.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
