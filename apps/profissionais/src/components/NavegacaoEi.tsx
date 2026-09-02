import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/useAuth";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { quantasVagasNovas } from "../lib/minhasVagas";

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
 *   quem trabalha   Vagas · Avisos · Meu perfil · Conta
 *   quem contrata   Minhas vagas · Profissionais · Empresa
 *   sem conta       Entrar
 *
 * Quatro itens no máximo, não cinco. O botão redondo do meio saiu junto:
 * ele existia para destacar a busca, que era A ação do procurô. Aqui não há
 * uma ação que domine as outras — há dois lados, cada um com o seu caminho.
 *
 * "Avisos" leva o selo com quantos ainda não foram abertos. O número já
 * estava escrito em `quantasVagasNovas` desde o começo, com o comentário
 * "para o aviso no menu" — e não era chamado em lugar nenhum.
 */

/* ── A BARRA PEDIDA EM 01/09 ──────────────────────────────────────────
   A dona: "na barra de baixo, deve ter opção de retornar a página
   anterior, as notificações, banco de talentos, painel da empresa ou do
   profissional."

   São quatro, e a primeira não é um destino: é uma AÇÃO. Voltar não tem
   endereço — ela desfaz o último passo —, e por isso o item ganhou a
   forma de botão. Foi a mudança que obrigou a mexer no tipo: até aqui
   todo item da barra era um `to`, e um `to: "voltar"` de mentira
   acenderia como página ativa e apareceria no histórico.

   O "banco de talentos" é a lista de profissionais, com o nome que a dona
   usa. Ela vale para os dois lados: quem contrata procura gente ali, e
   quem trabalha vê como o próprio cadastro aparece. */
type Destino = {
  to: string;
  label: string;
  icone: ReactNode;
  casa: (p: string) => boolean;
  /** Este item mostra o selo com quantos avisos ainda não foram abertos. */
  contaNovos?: boolean;
  /** Item de AÇÃO (voltar), sem endereço: vira botão, nunca acende. */
  acao?: "voltar";
};

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

const IconeSino = (
  <Svg>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </Svg>
);

const IconeVoltar = (
  <Svg>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

/* O ícone de "Entrar" saiu com o item: sem conta a barra inteira some
   (ver `destinos`), e um desenho sem uso é código que o próximo leitor
   tenta entender à toa. */

function destinos(tipo: "professional" | "company" | false | null, temConta: boolean): Destino[] {
  /* Voltar abre a barra em todos os casos: é a única que serve mesmo a
     quem ainda não entrou, e o lugar dela não muda com o papel. */
  const voltar: Destino = {
    to: "",
    acao: "voltar",
    label: "Voltar",
    icone: IconeVoltar,
    casa: () => false,
  };

  const talentos: Destino = {
    to: "/profissionais",
    label: "Talentos",
    icone: IconePessoas,
    casa: (p) => p.startsWith("/profissionais"),
  };

  if (!temConta) {
    /* Sem conta a barra não existe.
       ─────────────────────────────
       A dona olhou a tela de entrar e perguntou: "a barra nessa tela serve
       pra que?". Não servia para nada, e era pior que inútil: "Entrar"
       apontava para a tela onde ela já estava, e "Talentos" — depois que
       ver passou a exigir conta — devolvia a pessoa para o login de onde
       ela tinha acabado de sair. Três botões, nenhum destino.

       Uma barra de navegação num app onde ainda não há para onde navegar é
       enfeite com cara de app quebrado. */
    return [];
  }

  const avisos: Destino = {
    to: "/avisos",
    label: "Avisos",
    icone: IconeSino,
    contaNovos: true,
    casa: (p) => p.startsWith("/avisos"),
  };

  if (tipo === "company") {
    return [
      voltar,
      avisos,
      talentos,
      /* "Painel" abre a ESCOLHA DA EMPRESA, e não o painel de uma delas.
         ─────────────────────────────────────────────────────────────────
         A dona pediu três vezes a tela de cartões das empresas, e três
         vezes ela existiu sem ser alcançada: quem toca em "Painel" caía
         direto no painel de uma empresa, e a tela de escolha só aparecia
         para quem soubesse o endereço dela.

         `/minhas-empresas` manda para o cadastro sozinha quando não há
         empresa nenhuma, então quem está começando não vê uma escolha
         vazia. */
      /* O rótulo é o MESMO NOME da tela que abre. Estava "Painel", e a
         tela se chama "Suas empresas" — três nomes para a mesma coisa
         (a porta da tela inicial dizia "Minhas empresas") é o tipo de
         coisa que faz um app parecer confuso sem nenhuma tela estar
         errada. */
      { to: "/minhas-empresas", label: "Empresas", icone: IconePredio,
        casa: (p) => p.startsWith("/minhas-empresas") ||
          p.startsWith("/painel-empresa") || p.startsWith("/vaga") ||
          p.startsWith("/criar-vaga") || p.startsWith("/cadastro-empresa") ||
          p.startsWith("/planos-empresa") },
    ];
  }

  /* Profissional, e também quem entrou e ainda não escolheu o lado.

     ── "Avisos" é o histórico, e por isso ele fica ────────────────────
     A dona: "coloque também as notificações que as pessoas receberem dos
     disparos."

     Não é a mesma coisa que a lista de vagas, e a diferença é o motivo de
     ele existir: a lista mostra só o que está ABERTO, para responder —
     vaga encerrada some de lá, e é o certo. Só que aí o aviso desaparece:
     a pessoa recebe a notificação, demora dois dias para abrir o app, a
     empresa já encerrou, e não sobra nada. Nem a vaga, nem o registro de
     que ela existiu. Fica parecendo engano do app.

     A lista de vagas saiu da barra para caber o Voltar e o banco de
     talentos, que a dona pediu — ela continua a um toque, no Painel. */
  return [
    voltar,
    avisos,
    talentos,
    /* Mesmo motivo do lado da empresa: a tela se chama "Meu cadastro" na
       porta da tela inicial, e "Painel" aqui abria um formulário. */
    { to: "/painel", label: "Meu cadastro", icone: IconePessoa,
      casa: (p) => p.startsWith("/painel") || p.startsWith("/vagas-para-mim") },
  ];
}

export function NavegacaoEi() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { user } = useAuth();
  const tipo = useOnboardingStatus();

  /* Quantos avisos chegaram e ainda não foram abertos.
     ──────────────────────────────────────────────────
     Recarrega a cada troca de tela, e não só uma vez: quem abre os Avisos
     zera a conta, e sem isto o selo continuaria aceso com um número que já
     não é verdade — um número que mente é pior que nenhum.

     Erro aqui não aparece: é um selo, e derrubar a navegação inteira por
     causa dele seria trocar o que importa pelo que não importa. */
  const [novos, setNovos] = useState(0);
  useEffect(() => {
    if (!user) {
      setNovos(0);
      return;
    }
    let valeAinda = true;
    quantasVagasNovas(user.id)
      .then((n) => valeAinda && setNovos(n))
      .catch(() => {});
    return () => {
      valeAinda = false;
    };
  }, [user, pathname]);

  const itens = destinos(tipo, !!user);

  /* Uma barra de navegação com UM botão só, que aponta para a tela onde a
     pessoa já está, não é navegação — é um enfeite que parece quebrado.
     Era o que acontecia na tela de entrar: quem não tem conta recebe um
     único destino, "Entrar", e ele acendia apontando para si mesmo.

     Não confundir com esconder a barra do visitante em geral: em
     Profissionais o mesmo botão único é a única porta para dentro do app,
     e continua aparecendo. O que some é a barra que não leva a lugar
     nenhum. */
  if (itens.length === 0) return null;
  if (itens.length === 1 && itens[0].casa(pathname)) return null;

  /* Na tela que PERGUNTA de que lado a pessoa está, a barra não aparece.
     ────────────────────────────────────────────────────────────────────
     Quem ainda não escolheu recebe a barra de quem procura trabalho — o
     que é decisão tomada de propósito (ver `destinos`): a lista de vagas
     explica o app melhor que qualquer texto.

     Só que nesta tela isso vira contradição: o app pergunta "de que lado
     você está?" e oferece, no rodapé, "Meu perfil" — que leva ao cadastro
     PROFISSIONAL e grava o lado sem perguntar. A barra respondia a
     pergunta no lugar da pessoa. */
  if (pathname.startsWith("/onboarding-tipo")) return null;

  return (
    <nav className="nav-ei" aria-label="Navegação principal">
      {itens.map((d) => {
        const ativo = d.casa(pathname);
        /* O item de ação é um botão; os outros, links. O miolo é o mesmo
           nos dois, então ele é montado uma vez e embrulhado depois — sem
           isso, seriam dois blocos de JSX iguais que um dia divergem. */
        const Caixa = ({ children }: { children: ReactNode }) =>
          d.acao === "voltar" ? (
            <button
              type="button"
              className="nav-ei-item"
              onClick={() => navegar(-1)}
              aria-label="Voltar para a tela anterior"
            >
              {children}
            </button>
          ) : (
            <Link
              to={d.to}
              className={ativo ? "nav-ei-item ativo" : "nav-ei-item"}
              aria-current={ativo ? "page" : undefined}
            >
              {children}
            </Link>
          );

        return (
          <Caixa key={d.to || d.label}>
            {/* A cápsula é um elemento próprio, e não um fundo no item:
                ela precisa envolver SÓ o ícone, com o nome embaixo e fora.
                Um fundo no item inteiro vira um retângulo alto que engole o
                rótulo — o erro clássico de quem copia isto de olho. */}
            <span className="nav-ei-capsula">
              {d.icone}
              {/* O selo fica na CÁPSULA do ícone, e não no item inteiro:
                  no item ele iria parar ao lado do rótulo, embaixo, que é
                  onde ninguém procura um contador. */}
              {d.contaNovos && novos > 0 && (
                <span className="nav-ei-selo" aria-hidden="true">
                  {novos > 9 ? "9+" : novos}
                </span>
              )}
            </span>
            <span className="nav-ei-rotulo">
              {d.label}
              {/* O número precisa existir para quem usa leitor de tela, e o
                  selo acima é `aria-hidden` porque "3" solto não diz nada. */}
              {d.contaNovos && novos > 0 && (
                <span className="ei-so-leitor"> — {novos} não lidos</span>
              )}
            </span>
          </Caixa>
        );
      })}
    </nav>
  );
}
