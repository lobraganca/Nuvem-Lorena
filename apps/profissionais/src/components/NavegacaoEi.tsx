import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/useAuth";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { quantasVagasNovas } from "../lib/minhasVagas";
import { passeiPor, telaAnterior } from "../lib/historicoDoApp";
import { signOut } from "../lib/auth";

/**
 * A barra de baixo do Ei Emprego.
 *
 * A que existia era do procurô, e não por descuido: este código É o app do
 * procurô, renomeado. A barra dele oferecia **Anúncios, Buscar, Painel,
 * Perfil** — a espinha de um app para achar um encanador para a sua casa e
 * navegar em publicidade.
 *
 * O Ei Emprego é outro produto. Quem trabalha quer saber se apareceu vaga;
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
  /** Item de AÇÃO (voltar ou sair), sem endereço: vira botão, nunca acende. */
  acao?: "voltar" | "sair";
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

/* A porta com a seta saindo — o desenho que todo app usa para "sair da
   conta". A seta aponta para FORA da porta de propósito: apontando para
   dentro, o mesmo ícone quer dizer "entrar". */
const IconeSair = (
  <Svg>
    <path d="M14.5 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3.5" />
    <path d="M10 8.5L13.5 12 10 15.5" />
    <path d="M13.5 12H4" />
  </Svg>
);

/* Distinto de `IconePessoa` (o cadastro): aqui é a pessoa DENTRO de um
   contorno, para não ler como "meu perfil profissional" de novo — é a
   Conta, outra coisa. */
const IconeConta = (
  <Svg>
    <circle cx="12" cy="12" r="9.2" />
    <circle cx="12" cy="9.6" r="2.6" />
    <path d="M6.3 18.2a6 6 0 0 1 11.4 0" />
  </Svg>
);

/* O ícone de "Entrar" saiu com o item: sem conta a barra inteira some
   (ver `destinos`), e um desenho sem uso é código que o próximo leitor
   tenta entender à toa. */

function destinos(
  tipo: "professional" | "company" | false | null,
  temConta: boolean,
  /* Onde a pessoa está agora. Só serve para uma coisa: saber se ela está
     na casa do lado dela — ver `voltar`, logo abaixo. */
  ondeEstou: string
): Destino[] {
  /* ── NA CASA DO LADO, "VOLTAR" VIRA "SAIR" — 04/09 ──────────────────
     A dona: "nessa tela não há tela pra voltar. O botão de voltar deve
     ser trocado por sair e ser direcionado à tela inicial de login."

     `/comecar-empresa` e `/comecar-profissional` são o COMEÇO de cada
     lado: é para lá que o login manda, e é lá que a pessoa cai quando
     tenta abrir uma tela do outro lado. Não existe tela anterior, e o
     "Voltar" ali ou não fazia nada visível ou repetia a mesma tela.

     E "Sair" não é um remendo para preencher o lugar: sair e entrar é a
     ÚNICA forma de trocar de lado neste app (ver `ladoDaSessao.ts`).
     Quem está na casa da empresa e quer o lado de quem procura trabalho
     precisa exatamente deste botão — e ele não existia em lugar nenhum
     da barra, só lá dentro da Conta.

     Voltar continua em todas as outras telas: é a única que serve mesmo
     a quem ainda não entrou, e o lugar dela não muda com o papel. */
  const naCasaDoLado =
    ondeEstou === "/comecar-empresa" || ondeEstou === "/comecar-profissional";

  const voltar: Destino = naCasaDoLado
    ? { to: "", acao: "sair", label: "Sair", icone: IconeSair, casa: () => false }
    : { to: "", acao: "voltar", label: "Voltar", icone: IconeVoltar, casa: () => false };

  const talentos: Destino = {
    to: "/profissionais",
    label: "Talentos",
    icone: IconePessoas,
    casa: (p) => p.startsWith("/profissionais"),
  };

  if (!temConta || tipo === false || tipo === null) {
    /* Sem conta, OU com conta mas sem lado escolhido, a barra não existe.
       ────────────────────────────────────────────────────────────────
       A dona olhou a tela de entrar e perguntou: "a barra nessa tela serve
       pra que?". Não servia para nada, e era pior que inútil: "Entrar"
       apontava para a tela onde ela já estava, e "Talentos" — depois que
       ver passou a exigir conta — devolvia a pessoa para o login de onde
       ela tinha acabado de sair. Três botões, nenhum destino.

       Uma barra de navegação num app onde ainda não há para onde navegar é
       enfeite com cara de app quebrado.

       ── E o mesmo vale para quem TEM conta e ainda não escolheu lado ──
       A dona: "os botões da barra fixa: avisos, talentos e cadastro, bem
       como os da empresa só devem aparecer quando for selecionado o
       perfil que você quer, empresa ou profissional."

       Isto era um bug, não uma escolha: só havia `if (tipo === "company")`
       antes deste retorno, e o `return` de profissional no fim da função
       cobria QUALQUER outro valor — inclusive `false` (conta sem lado) e
       `null` (ainda carregando). Uma pessoa que tinha acabado de criar
       conta e ainda não dissera se procura trabalho ou contrata já via
       Avisos, Talentos e "Cadastro" — três atalhos para telas de um papel
       que ela não tinha escolhido, e que empurrar por engano leva ao
       cadastro errado. */
    return [];
  }

  const avisos: Destino = {
    to: "/avisos",
    label: "Avisos",
    icone: IconeSino,
    contaNovos: true,
    casa: (p) => p.startsWith("/avisos"),
  };

  /* Voltou para a barra — 02/09.
     ────────────────────────────
     A dona: "ter botão de sair da conta, daí desloga e volta a tela de
     login."

     "Conta" era um dos quatro itens no desenho original da barra (ver o
     comentário no topo do arquivo: "quem trabalha tem Vagas, Avisos, Meu
     perfil e Conta"), e sumiu sem ninguém decidir isso — foi perdendo o
     lugar para "Voltar" e "Talentos", que entraram depois, até não sobrar
     vaga para ele. O efeito: `/perfil`, onde mora o botão "Sair da
     conta", ficou SEM NENHUM caminho a partir da barra — só digitando o
     endereço. Foi o que aconteceu de verdade: perguntada onde ficava o
     botão de sair, a resposta foi "não achei". */
  const conta: Destino = {
    to: "/perfil",
    label: "Conta",
    icone: IconeConta,
    casa: (p) => p.startsWith("/perfil") || p.startsWith("/configuracao"),
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
      conta,
    ];
  }

  /* Só chega aqui quem já escolheu ser profissional — o `if` anterior já
     tirou quem contrata, e o `return []` do topo já tirou quem ainda não
     tem lado nenhum.

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
    /* ── VAGAS NO LUGAR DE TALENTOS, DESTE LADO — 04/09 ─────────────────
       A dona pediu uma varredura de botões redundantes, e este é o caso
       mais caro do app: quem procura emprego não tinha, em lugar nenhum da
       barra, um caminho para as vagas. A barra dela era Voltar, Avisos,
       Talentos, Cadastro e Conta — cinco itens, e o produto inteiro fora
       deles. Aberta uma vaga, para ver outra a pessoa tinha de voltar duas
       ou três telas.

       "Banco de talentos" continua onde a dona pediu que ficasse: na tela
       de "Procuro emprego", no par de quadrados embaixo das portas ("os
       botões de banco de talentos e de vagas devem ficar debaixo de vagas
       compatíveis"). Ele não some do app — sai da barra, onde era o item
       que menos serve a quem está procurando trabalho, e cede o lugar ao
       que ela abre o app para ver.

       Do lado da empresa ele fica na barra: ali procurar gente É o
       trabalho. */
    {
      to: "/vagas",
      label: "Vagas",
      icone: IconeVagas,
      casa: (p) => p.startsWith("/vagas"),
    },
    /* Mesmo motivo do lado da empresa: a tela se chama "Meu cadastro" na
       porta da tela inicial, e "Painel" aqui abria um formulário. */
    /* Abre a ESCOLHA do cadastro, e não o formulário — igualzinho ao lado
       da empresa logo acima, que abre "Suas empresas". Uma conta pode ter
       até cinco cadastros (a diarista que também cozinha), e cair direto no
       primeiro esconderia os outros. Quem não tem nenhum é levado ao
       formulário pela própria tela de escolha. */
    { to: "/meus-cadastros", /* "Meu cadastro" não cabe na aba e saía "Meu
       cadas…". A tela continua se chamando assim; a aba usa a palavra que
       a nomeia. */
      label: "Cadastro", icone: IconePessoa,
      /* `/vagas-para-mim` saiu daqui: ela acende a aba "Vagas", que agora
         existe. Com as duas regras, duas abas acendiam ao mesmo tempo. */
      casa: (p) => p.startsWith("/meus-cadastros") || p.startsWith("/painel") },
    conta,
  ];
}

export function NavegacaoEi() {
  const { pathname, search: busca } = useLocation();
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

  /* ── A ORDEM DAS TELAS DO APP — 04/09 ────────────────────────────
     Empilhada aqui porque esta barra é montada em toda tela do app (ela
     só se esconde na inicial, e isso acontece DEPOIS deste efeito — um
     `return null` antes de um hook mudaria a ordem dos hooks e quebraria
     o React).

     `search` entra junto: o banco de vagas guarda busca, filtro e modo na
     URL, e voltar para o endereço sem eles jogaria fora o que a pessoa
     tinha filtrado. */
  useEffect(() => {
    passeiPor(`${pathname}${busca}`);
  }, [pathname, busca]);

  const itens = destinos(tipo, !!user, pathname);

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

  /* A dona: "a barra ainda continua na tela 'por onde começamos'."
     ─────────────────────────────────────────────────────────────
     `/` e `/inicio` são a EntradaPage — a mesma pergunta de cima, só que
     para quem JÁ tem lado escolhido e está trocando (ver `EntradaPage`,
     item "Por onde começamos?"). Como o lado já existe, `destinos` não
     devolve `[]` como devolveria para quem não tem lado — devolve a
     barra do lado atual, que aqui é a mesma contradição de cima: a tela
     pergunta "por onde começamos?" com a barra do lado de UM dos dois já
     acesa ao lado da pergunta. */
  if (pathname === "/" || pathname === "/inicio") return null;

  return (
    <nav className="nav-ei" aria-label="Navegação principal">
      {itens.map((d) => {
        const ativo = d.casa(pathname);
        /* O item de ação é um botão; os outros, links. O miolo é o mesmo
           nos dois, então ele é montado uma vez e embrulhado depois — sem
           isso, seriam dois blocos de JSX iguais que um dia divergem. */
        const Caixa = ({ children }: { children: ReactNode }) =>
          d.acao === "sair" ? (
            /* Sair de verdade: `signOut` encerra a sessão do Supabase E
               apaga o lado escolhido (ver `lib/auth.ts`), que é o que faz
               a tela de login voltar a perguntar de que lado a pessoa
               entra. Só depois disso o destino é a tela de login.

               `replace` para o botão de voltar do aparelho não trazer de
               volta a tela de dentro do app, que já não tem sessão. */
            <button
              type="button"
              className="nav-ei-item"
              onClick={() => {
                void signOut().finally(() => navegar("/login", { replace: true }));
              }}
              aria-label="Sair da conta e voltar para a tela de entrar"
            >
              {children}
            </button>
          ) : d.acao === "voltar" ? (
            /* ── VOLTA PARA A TELA INICIAL, E NÃO UM PASSO ATRÁS — 04/09
                A dona: "o botão de voltar tem que voltar a tela inicial do
                app. Quando volta, alguns botões da tela anterior não estão
                funcionando."

                As duas frases são o mesmo defeito. Era `navegar(-1)`, que
                anda no histórico do navegador — e o histórico deste app tem
                entradas que não sobrevivem à volta: a troca de lado e o
                login recarregam a página inteira (`location.href`), então
                voltar cai numa tela montada com o lado ANTERIOR. Os botões
                de lá continuam desenhados, mas apontam para o outro lado e
                não fazem nada visível. Foi exatamente o que ela viu.

                Ir sempre para "/" não tem esse estado: a tela inicial se
                monta do zero, lê o lado atual e mostra as duas portas. Um
                destino fixo também é o que a barra de baixo faz em todos os
                outros itens — o "Voltar" era o único imprevisível. */
            <button
              type="button"
              className="nav-ei-item"
              onClick={() => {
                /* A tela anterior DO APP, e não um passo no histórico do
                   navegador (ver `historicoDoApp.ts`): navegar para o
                   endereço monta a tela do zero, com o lado e a sessão de
                   agora — que é o que fazia a volta pelo histórico
                   entregar botões que não funcionavam.

                   Sem tela anterior (app aberto direto num link), o
                   destino de reserva é a inicial. */
                navegar(telaAnterior() ?? "/");
              }}
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
