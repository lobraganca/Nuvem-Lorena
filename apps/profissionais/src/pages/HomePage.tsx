import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { DEFAULT_CITY, GRUPOS_DE_SERVICOS } from "../types/domain";
import { IconeDeServico } from "../components/IconeDeServico";
import { Prateleira } from "../components/Prateleira";
import { CartaoVitrine } from "../components/CartaoVitrine";
import { CartaoProfissional } from "../components/CartaoProfissional";
import {
  DEFAULT_PAGE_SIZE,
  getCategoriasComAnuncio,
  getCidadesComAnuncio,
  getMaisVistos,
  getRecomendados,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type ProfessionalWithRating,
  type SortOption,
} from "../lib/professionals";
import { hasDatabase, problemaDeConfiguracao } from "../lib/supabase";
import { mensagemDeErro } from "../lib/erros";
import { oficiosParaNecessidade } from "../lib/necessidades";
import { FavoriteButton } from "../components/FavoriteButton";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Estrelas } from "../components/Estrelas";
import { TourGuide, type TourStep } from "../components/TourGuide";
import { hasSeenWelcome, markTourSeen, shouldRunTour } from "../lib/onboarding";
import { temDestinoLogin } from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { BottomSheet } from "../components/BottomSheet";
import { enviarIndicacao } from "../lib/indicacoes";
import { formatPhone } from "../lib/phone";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { corDoNome, iniciais } from "../lib/avatar";

/**
 * Passos do tour de primeiro acesso. Cada um aponta para um pedaço real da
 * tela (`data-tour`) — se o elemento não estiver visível, o passo vira um
 * cartão centralizado e o texto ainda se sustenta sozinho.
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: "filtros",
    title: "Comece pela categoria",
    text: "Escolha o serviço e a cidade. Dá para refinar por nota mínima e ordenar por melhor avaliado — na sua cidade ou nas vizinhas.",
  },
  {
    target: "resultados",
    title: "Quem aparece aqui",
    text: "Autônomos e empresas na mesma lista, com a nota e as etiquetas que receberam. O selo Premium indica quem assina o plano pago — não é avaliação nossa; quem diz se o trabalho é bom são as avaliações.",
  },
  {
    target: "nav-favoritos",
    title: "Guarde para depois",
    text: "O coração em cada cartão salva o profissional nos seus favoritos, para você não perder o contato de quem atendeu bem. A lista fica aqui no Perfil, em \"Meus favoritos\".",
  },
  {
    target: "nav-painel",
    title: "Você também presta serviço?",
    text: "No Painel você cria seu próprio cadastro, como pessoa física ou empresa. É grátis — o selo e o destaque são opcionais.",
  },
];

export function HomePage() {
  useTituloDaPagina();
  const [city, setCity] = useState<string>("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidadeAberta, setCidadeAberta] = useState(false);
  /**
   * A busca mora no endereço — e é isso que faz o "voltar" funcionar.
   *
   * Antes, `?servico=` era lido uma vez e apagado em seguida, para um
   * recarregar não ressuscitar uma busca que a pessoa já tinha abandonado.
   * A intenção estava certa; o efeito colateral era grave e passou meses
   * sem ser nomeado: **abrir um cadastro e voltar apagava a busca**. A
   * pessoa procurava eletricista, entrava num, achava caro, voltava — e
   * caía na grade de categorias, do zero, tendo que escolher tudo de novo.
   * Comparar dois profissionais, que é o motivo de existir uma lista,
   * custava refazer a busca a cada comparação.
   *
   * Agora o endereço acompanha a busca (`/?servico=Eletricista&q=forno`).
   * Voltar devolve a tela como ela estava, porque o navegador guarda o
   * endereço e o endereço guarda a busca.
   *
   * E o medo original não se realiza: como o endereço é reescrito sempre
   * que a busca muda, limpar a busca também limpa o parâmetro. Não existe
   * mais "parâmetro velho" para ressuscitar nada.
   */
  const paramsIniciais = () =>
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [category, setCategory] = useState<string>(() => paramsIniciais().get("servico") ?? "");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [text, setText] = useState<string>(() => paramsIniciais().get("q") ?? "");
  /* Já nasce preenchido junto com `text`: o debounce serve para não buscar
     a cada tecla digitada, e quem volta de outra tela não digitou nada —
     esperar 400ms aqui só atrasaria a lista que ela já tinha. */
  const [debouncedText, setDebouncedText] = useState<string>(() => paramsIniciais().get("q") ?? "");
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [results, setResults] = useState<ProfessionalWithRating[]>([]);
  /* A lista que alimenta as prateleiras da tela inicial. Separada de
     `results`, que é o resultado da busca: as duas nunca aparecem juntas,
     mas misturá-las faria a vitrine sumir e voltar a cada tecla digitada. */
  const [vitrine, setVitrine] = useState<ProfessionalWithRating[]>([]);
  const [emAlta, setEmAlta] = useState<ProfessionalWithRating[]>([]);
  const [recomendados, setRecomendados] = useState<ProfessionalWithRating[]>([]);
  const [loading, setLoading] = useState(false);
  /* Falha de busca tem tela própria. Enquanto `searchProfessionals`
     devolvia lista vazia em caso de erro, "não achamos ninguém" cobria
     duas situações opostas — a cidade não tem esse serviço, e o app está
     quebrado — e só a primeira era verdade na maioria das vezes em que
     apareceu. */
  const [erroBusca, setErroBusca] = useState("");
  /* "Tentar de novo" precisa de um número que muda, não de um estado que
     volta ao mesmo valor: repetir a mesma busca não altera texto nem
     categoria, e o React não roda um efeito cujas dependências ficaram
     iguais. Este contador é a dependência que muda. */
  const [tentativa, setTentativa] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Quem nunca viu a tela de início é mandado para lá antes da busca —
  // EXCETO quando esta carga é a volta do login.
  //
  // O Google devolve a pessoa para cá com o token pendurado no endereço
  // (#access_token=... ou ?code=...). O Supabase lê isso e cria a sessão,
  // mas leva um instante. Um `Navigate` disparado antes disso troca a URL e
  // leva o token junto: a pessoa entrava no Google, voltava, e o app estava
  // deslogado — sem erro nenhum na tela, o que é pior.
  const [redirectToWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    const voltandoDoLogin =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      window.location.search.includes("code=");
    // `temDestinoLogin` cobre o caso que o teste do endereço não cobre: o
    // Supabase pode já ter limpado o token da URL antes desta tela montar, e
    // aí a volta do login parece uma visita comum — a pessoa era mandada para
    // a tela de início em vez do painel, e o login parecia não ter funcionado.
    // Quem chega com um serviço escolhido veio de dentro do app, pela tela
    // de categorias — mandá-lo para a apresentação jogaria fora a escolha
    // que ele acabou de fazer.
    const comServicoEscolhido = new URLSearchParams(window.location.search).has("servico");
    return !voltandoDoLogin && !comServicoEscolhido && !temDestinoLogin() && !hasSeenWelcome();
  });
  const { user } = useAuth();
  const [indicarAberto, setIndicarAberto] = useState(false);
  const [indNome, setIndNome] = useState("");
  const [indContato, setIndContato] = useState("");
  const [indSaving, setIndSaving] = useState(false);
  const [indEnviada, setIndEnviada] = useState(false);
  const [indErro, setIndErro] = useState("");

  /* O endereço volta a ser só "/" depois que a escolha foi lida. Sem isto,
     a pessoa limpa a busca, recarrega a tela e a categoria antiga volta —
     porque continuava escrita ali. */
  /* O endereço segue a busca.
     `replaceState` e não `push`: cada tecla digitada viraria um item no
     histórico, e sair da busca exigiria apertar "voltar" uma vez por
     letra. O que precisa entrar no histórico é a ida ao cadastro, e essa
     quem cria é o link do cartão. */
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("servico", category);
    if (debouncedText.trim()) params.set("q", debouncedText.trim());
    const busca = params.toString();
    const destino = window.location.pathname + (busca ? `?${busca}` : "");
    if (destino !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", destino);
    }
  }, [category, debouncedText]);

  /* A vitrine inteira sai de duas idas ao banco, não de uma por prateleira.
     "Bem avaliados" e "Novos por aqui" são a mesma lista ordenada de dois
     jeitos — pedir duas vezes a mesma coisa na tela mais aberta do app é
     custo sem troco. "Em alta" precisa da sua própria, porque a contagem de
     visitas só existe dentro do banco (migration 0059).

     `sort: "rating"` não é por acaso: a ordenação padrão embaralha (o
     rodízio que impede o primeiro cadastro da cidade de ficar sempre por
     último), e prateleira ordenada por relevância aleatória não significa
     nada. Aqui a ordem vem imposta abaixo, campo a campo. */
  useEffect(() => {
    let ativo = true;

    searchProfessionals({ pageSize: 50, sort: "rating" })
      .then((lista) => ativo && setVitrine(lista))
      .catch(() => ativo && setVitrine([]));

    /* Falha aqui não estraga a tela: sem "Em alta", as outras prateleiras
       continuam de pé. É o único lugar do app onde lista vazia em caso de
       erro é a resposta certa — a prateleira simplesmente não aparece, e
       não há nada que a pessoa possa fazer a respeito. */
    getMaisVistos()
      .then((lista) => ativo && setEmAlta(lista))
      .catch(() => ativo && setEmAlta([]));

    getRecomendados()
      .then((lista) => ativo && setRecomendados(lista))
      .catch(() => ativo && setRecomendados([]));

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    /* A lista de cidades é conveniência: se falhar, o seletor fica com as
       cidades fixas do app e ninguém perde nada. */
    getCidadesComAnuncio().then(setCidades).catch(() => {});
    // O filtro de serviços vem dos cadastros, não da lista fixa do código:
    // quem escreveu o próprio ofício no cadastro precisa ser encontrável por
    // ele, e serviço sem ninguém cadastrado só levaria a uma tela vazia.
    getCategoriasComAnuncio().then(setCategorias);
  }, []);

  // Debounce (~400ms) do texto digitado antes de disparar a busca, para não
  // gerar uma query por tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text), 400);
    return () => clearTimeout(t);
  }, [text]);

  // O tour só roda depois que a busca já tem o que mostrar — apontar para uma
  // lista vazia não ensinaria nada.
  useEffect(() => {
    if (loading) return;
    if (shouldRunTour()) setShowTour(true);
  }, [loading]);

  function finishTour() {
    markTourSeen();
    setShowTour(false);
  }

  /* Só busca depois de um gesto explícito — texto digitado ou categoria
     escolhida. Cidade e nota mínima não contam sozinhas: eram os valores já
     preenchidos no primeiro carregamento, e é justamente esse carregamento
     automático que parava de acontecer aqui. Mostrar todo mundo cadastrado
     assim que a tela abre lotava a entrada com cadastro, sem a pessoa ter
     pedido nada ainda. */
  const buscouAlgo = debouncedText.trim() !== "" || category !== "";

  /**
   * Desfaz a busca e devolve a grade de ofícios.
   *
   * Sem isto, tocar num cartão de categoria era um caminho de ida: a grade
   * sumia (é ela que ocupa o lugar dos resultados), e voltar dependia de
   * achar o filtro de serviços lá em cima e devolvê-lo à mão para "Todos os
   * serviços" — um gesto que ninguém adivinha e que, no celular, acontece
   * fora da tela. Quem tocasse errado ficava preso na categoria escolhida.
   *
   * Zera o texto e a categoria, que são os dois gatilhos da busca. Cidade e
   * nota mínima ficam: elas sozinhas não escondem a grade, e apagar uma
   * escolha que a pessoa não pediu para apagar é outra surpresa.
   */
  /* As três prateleiras de gente, derivadas do que já foi buscado.

     "Bem avaliados" exige avaliação de verdade: sem `review_count > 0`, a
     prateleira encheria de cadastros sem nota nenhuma e o título viraria
     mentira. */
  const bemAvaliados = vitrine
    .filter((p) => (p.review_count ?? 0) > 0 && p.average_rating !== null)
    .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
    .slice(0, 12);

  const novos = [...vitrine]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 12);

  /* Quantos cadastros existem por ofício, contados do que veio — evita uma
     terceira consulta só para o número do cartão. */
  const quantosPorOficio = new Map<string, number>();
  for (const p of vitrine) {
    for (const c of p.categories?.length ? p.categories : [p.category]) {
      if (c) quantosPorOficio.set(c, (quantosPorOficio.get(c) ?? 0) + 1);
    }
  }

  /* Só os grupos que têm gente cadastrada, e dentro de cada um só os
     ofícios com cadastro. Grupo vazio não vira faixa: título com fileira
     vazia embaixo é a tela dizendo que quebrou. */
  const gruposComGente = GRUPOS_DE_SERVICOS.map((g) => ({
    nome: g.grupo as string,
    itens: (g.itens as readonly string[]).filter((i) => quantosPorOficio.has(i)),
  })).filter((g) => g.itens.length > 0);

  /* Os ofícios que a frase digitada quer dizer. Só existe quando a pessoa
     escreveu uma necessidade — buscar por nome de pessoa ou pelo próprio
     ofício não produz tradução, e aí nada aparece na tela. */
  const oficiosDaNecessidade = category === "" ? oficiosParaNecessidade(debouncedText) : [];

  /* Tocar no ofício traduzido troca a busca por ele: quem digitou
     "chuveiro" e viu "Eletricista ou Encanador" escolhe qual dos dois, em
     vez de digitar de novo. O texto sai, senão os dois filtros se somariam
     e a lista ficaria menor a cada toque. */
  function buscarOficio(oficio: string) {
    setText("");
    setDebouncedText("");
    setCategory(oficio);
  }

  /* O chip do topo leva à parte da fileira onde aquele grupo começa.

     Era um link de âncora, e funcionava enquanto cada grupo tinha a sua
     faixa. Com todos os ofícios numa fileira só, âncora não serve: o
     navegador rolaria a *página* até um item que já está visível, sem mexer
     na rolagem lateral, que é onde o grupo está escondido. Aqui a página
     vai até a faixa e a fileira anda de lado até o primeiro ofício do
     grupo — as duas coisas que faltavam. */
  function irParaOGrupo(id: string) {
    const alvo = document.getElementById(`grupo-${id}`);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  function verTodosOsServicos() {
    setText("");
    setDebouncedText("");
    setCategory("");
  }

  /* Cada busca nova precisa "vencer" a anterior, não só ser disparada
     depois dela. Sem isto, se a primeira busca demorar mais que a segunda
     — rede lenta, servidor ocupado, qualquer variação de tempo —, ela
     chega por último e sobrescreve o resultado certo pelo errado: a
     pessoa via a busca antiga (ou vazia) mesmo tendo pedido outra coisa
     depois, sem erro nenhum na tela para explicar por quê. Um número que
     só sobe identifica qual busca é a mais recente; ao voltar, só o
     resultado dela é aceito. */
  const buscaAtual = useRef(0);

  useEffect(() => {
    const minhaBusca = ++buscaAtual.current;
    if (!buscouAlgo) {
      setResults([]);
      setHasMore(false);
      setLoading(false);
      setErroBusca("");
      return;
    }
    setLoading(true);
    setErroBusca("");
    setPage(0);
    searchProfessionals({
      city: city || undefined,
      category: category || undefined,
      text: debouncedText || undefined,
      minRating: minRating || undefined,
      sort,
      page: 0,
    }).then((data) => {
      if (minhaBusca !== buscaAtual.current) return; // já tem busca mais nova em andamento
      setResults(data);
      setHasMore(data.length === DEFAULT_PAGE_SIZE);
      setLoading(false);
    }).catch((err) => {
      if (minhaBusca !== buscaAtual.current) return;
      setResults([]);
      setHasMore(false);
      setLoading(false);
      setErroBusca(mensagemDeErro(err, "Não conseguimos buscar agora."));
    });
  }, [buscouAlgo, city, category, debouncedText, minRating, sort, tentativa]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setErroBusca("");
    try {
      const data = await searchProfessionals({
        city: city || undefined,
        category: category || undefined,
        text: debouncedText || undefined,
        minRating: minRating || undefined,
        sort,
        page: nextPage,
      });
      setResults((prev) => [...prev, ...data]);
      setHasMore(data.length === DEFAULT_PAGE_SIZE);
      setPage(nextPage);
    } catch (err) {
      /* A lista que já está na tela fica. Quem pediu "ver mais" não perde o
         que estava lendo por causa de uma página que não veio. */
      setErroBusca(mensagemDeErro(err, "Não conseguimos carregar mais agora."));
    } finally {
      setLoadingMore(false);
    }
  }

  if (redirectToWelcome) return <Navigate to="/inicio" replace />;

  return (
    <div className="container">
      {showTour && <TourGuide steps={TOUR_STEPS} onFinish={finishTour} />}

      {/* Quem chega aqui vem procurar alguém — mas parte de quem procura
          também presta serviço, e essa pessoa não tem por que descobrir
          sozinha que existe um Painel no rodapé. O convite fica no alto,
          numa faixa fina: visível de primeira, sem disputar espaço com a
          busca, que continua sendo o assunto principal da tela. */}
      {/* A cidade, no alto e por extenso.
          Ela morava num `select` no meio de quatro filtros — a informação
          que decide o que a tela inteira mostra, escondida entre "nota
          mínima" e "ordenar por". Quem abria o app não tinha como saber de
          onde eram as pessoas que estava vendo, e quem é de fora não
          descobria que dava para trocar.
          Aqui em cima ela é a primeira coisa lida, como o endereço nos
          aplicativos de entrega, e continua sendo escolha de quem procura —
          é um botão, não um enfeite. */}
      <button type="button" className="endereco-topo" onClick={() => setCidadeAberta(true)}>
        <span className="endereco-topo-pino" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.6" />
          </svg>
        </span>
        <span className="endereco-topo-texto">
          <strong>{city || "Todas as cidades"}</strong>
          <span className="endereco-topo-dica">{city ? "Toque para trocar" : "Toque para escolher a sua"}</span>
        </span>
        <span className="endereco-topo-seta" aria-hidden="true">›</span>
      </button>

      {cidadeAberta && (
        <BottomSheet title="De qual cidade?" onClose={() => setCidadeAberta(false)}>
          <div className="lista-cidades">
            <button
              type="button"
              className={`linha-cidade${city === "" ? " ativa" : ""}`}
              onClick={() => {
                setCity("");
                setCidadeAberta(false);
              }}
            >
              Todas as cidades
            </button>
            {cidades.map((c) => (
              <button
                key={c}
                type="button"
                className={`linha-cidade${city === c ? " ativa" : ""}`}
                onClick={() => {
                  setCity(c);
                  setCidadeAberta(false);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      <Link to="/painel" className="cta-anunciar">
        {/* Encurtado para caber numa linha. "e apareça nas buscas" dizia o
            que a tela inteira já demonstra — a pessoa está olhando a busca
            — e era o que empurrava o aviso para duas linhas. */}
        <span className="cta-anunciar-texto">
          <strong>Presta serviço?</strong> Cadastre-se grátis
        </span>
        <span className="cta-anunciar-seta" aria-hidden="true">
          →
        </span>
      </Link>

      {/* Título curto e sem parágrafo de apoio: no celular, o texto anterior
          empurrava o campo de busca para fora da primeira tela — a pessoa
          precisava rolar para fazer a única coisa que veio fazer. O que era
          explicação virou a própria dica dentro do campo. */}
      <section className="hero-busca">
        <h1>Quem você procura hoje?</h1>
        {/* Sem citar cidade: o app passou a ser divulgado em mais lugares, e
            uma cidade escrita na frase de abertura diz "isto não é para
            você" a quem abriu de qualquer outra. O recorte por cidade
            continua existindo — mas no filtro, escolhido por quem procura. */}
        <p className="muted">Profissionais da sua região, com avaliação de quem já contratou.</p>
        {/* O contador de quem está on-line subiu para o cabeçalho, que
            aparece em todas as telas. Aqui ele seria a segunda vez na
            mesma tela. */}
        {!hasDatabase() && (
          <p className="badge badge-boosted" style={{ marginTop: 12, whiteSpace: "normal", textAlign: "left" }}>
            Sem conexão com o banco: {problemaDeConfiguracao()}
          </p>
        )}
      </section>

      <div className="search-block" data-tour="filtros">
        {/* A busca por texto é o que a maioria vem fazer: campo largo, alto e
            com contorno visível, sozinho na primeira linha. Os filtros descem
            para baixo — servem para refinar, não para começar. */}
        <div className="search-field">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            placeholder="O que você precisa? Ex: eletricista"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Buscar profissional por nome ou serviço"
          />
        </div>

        <div className="filter-grid">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
            <option value="">Todos os serviços</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} aria-label="Nota mínima">
            <option value={0}>Qualquer nota</option>
            <option value={4}>4+ estrelas</option>
            <option value={3}>3+ estrelas</option>
            <option value={2}>2+ estrelas</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} aria-label="Ordenar por">
            <option value="relevance">Mais relevante</option>
            <option value="rating">Melhor avaliado</option>
            <option value="reviews">Mais avaliações</option>
          </select>
        </div>
      </div>

      {indicarAberto && (
        <BottomSheet
          title={indEnviada ? "Obrigada!" : "Indicar um profissional"}
          subtitle={
            indEnviada
              ? undefined
              : "A gente entra em contato e convida. Não precisa saber tudo — nome e telefone já bastam."
          }
          onClose={() => {
            setIndicarAberto(false);
            setIndEnviada(false);
          }}
        >
          {indEnviada ? (
            <div style={{ display: "grid", gap: 14 }}>
              <p style={{ margin: 0 }}>
                Anotado. Indicação de quem já conhece o trabalho vale mais que qualquer cadastro — é assim que
                esta lista cresce com gente boa.
              </p>
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  setIndicarAberto(false);
                  setIndEnviada(false);
                }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <input
                placeholder="Nome da pessoa (ou como a conhecem)"
                value={indNome}
                onChange={(e) => setIndNome(e.target.value)}
              />
              <input
                placeholder="Telefone ou WhatsApp, se souber"
                value={indContato}
                inputMode="tel"
                onChange={(e) => setIndContato(formatPhone(e.target.value))}
              />
              {indErro && <p className="form-erro">{indErro}</p>}
              <button
                className="btn btn-primary btn-block"
                disabled={indSaving}
                onClick={async () => {
                  if (!indNome.trim() && !indContato.trim()) {
                    setIndErro("Escreva pelo menos o nome ou o telefone.");
                    return;
                  }
                  setIndSaving(true);
                  setIndErro("");
                  try {
                    await enviarIndicacao({
                      // O termo buscado vai junto: saber que 40 pessoas
                      // procuraram "soldador" e não acharam já vale sozinho.
                      servico_buscado: category || debouncedText || null,
                      cidade: city || DEFAULT_CITY,
                      nome_indicado: indNome.trim() || null,
                      contato_indicado: indContato.trim() || null,
                      user_id: user?.id ?? null,
                    });
                    setIndNome("");
                    setIndContato("");
                    setIndEnviada(true);
                  } catch (err) {
                    setIndErro(mensagemDeErro(err, "Não foi possível enviar agora."));
                  } finally {
                    setIndSaving(false);
                  }
                }}
              >
                {indSaving ? "Enviando…" : "Enviar indicação"}
              </button>
            </div>
          )}
        </BottomSheet>
      )}

      {!buscouAlgo && (
        /* A vitrine: o que a cidade tem, antes de a pessoa pedir.
           Aqui já foi uma grade de oito categorias e mais nada — a tela só
           perguntava, e quem abria o app pela primeira vez não via uma
           pessoa sequer. Cidade que parece vazia não traz ninguém de volta.
           Agora as categorias continuam (nas prateleiras de grupo, mais
           abaixo), mas depois de mostrar gente de verdade. */
        <div data-tour="resultados" className="vitrine">
          {/* Os chips grudam no alto ao rolar, abaixo do cabeçalho. São os
              grupos do catálogo — os mesmos do formulário de cadastro —, e
              não os ofícios: dez chips atravessam a tela; noventa e oito
              seriam uma fita infinita que ninguém percorre. */}
          {gruposComGente.length > 0 && (
            <div className="chips-grupo" role="tablist" aria-label="Grupos de serviço">
              {gruposComGente.map((g) => (
                <button
                  key={g.nome}
                  type="button"
                  className="chip-grupo"
                  onClick={() => irParaOGrupo(idDoGrupo(g.nome))}
                >
                  <IconeDeServico categoria={g.itens[0]} tamanho={16} />
                  {g.nome}
                </button>
              ))}
            </div>
          )}

          <Prateleira
            titulo="Em alta em Itabirito"
            subtitulo="Os mais procurados nos últimos dias"
            ancora="prateleira-em-alta"
            quantidade={emAlta.length}
          >
            {emAlta.map((p) => (
              <CartaoVitrine key={p.id} p={p} />
            ))}
          </Prateleira>

          {/* Antes de "bem avaliados", porque é mais forte: nota alta com
              uma avaliação só pode ser um primo; aqui houve serviço
              prestado e quem pagou disse que valeu. */}
          <Prateleira
            titulo="Recomendados"
            subtitulo="Quem já foi contratado e voltou bem avaliado"
            quantidade={recomendados.length}
            minimo={2}
          >
            {recomendados.map((p) => (
              <CartaoVitrine key={p.id} p={p} />
            ))}
          </Prateleira>

          <Prateleira
            titulo="Bem avaliados"
            subtitulo="Quem já foi contratado e recebeu nota"
            quantidade={bemAvaliados.length}
          >
            {bemAvaliados.map((p) => (
              <CartaoVitrine key={p.id} p={p} />
            ))}
          </Prateleira>

          <Prateleira
            titulo="Novos por aqui"
            subtitulo="Cadastros mais recentes"
            quantidade={novos.length}
          >
            {novos.map((p) => (
              <CartaoVitrine key={p.id} p={p} />
            ))}
          </Prateleira>

          {/* Todos os ofícios num bloco só, em duas fileiras.

              Cada grupo já teve a sua prateleira: dez títulos, dez faixas
              cinzentas, cartões grandes de três em três. Somado, dava uma
              tela que não acabava mais para dizer uma coisa simples — quais
              serviços existem na cidade. Era muito pedaço para pouca
              informação, e foi assim que a dona descreveu: segmentado
              demais, ocupando espaço demais.

              Agora é uma faixa só. Os ofícios continuam na ordem dos
              grupos, então os parecidos seguem vizinhos, e cada chip lá em
              cima rola esta fileira até o começo do seu grupo — o que os
              dez títulos faziam, sem os dez títulos.

              Duas fileiras e não uma: com uma, a pastilha ficaria sozinha
              numa faixa alta e sobraria branco embaixo; com três, a fileira
              passa da altura da tela e vira outra coisa para rolar. */}
          <Prateleira
            titulo="Serviços em Itabirito"
            subtitulo="Toque para ver quem faz"
            verTudo="/categorias"
            minimo={1}
            quantidade={quantosPorOficio.size}
            duasFileiras
          >
            {gruposComGente.flatMap((g) =>
              g.itens.map((nome, i) => (
                <button
                  key={nome}
                  type="button"
                  className="cartao-oficio"
                  role="listitem"
                  /* O primeiro de cada grupo carrega a âncora: é nele que o
                     chip do topo encosta a rolagem. */
                  id={i === 0 ? `grupo-${idDoGrupo(g.nome)}` : undefined}
                  onClick={() => setCategory(nome)}
                >
                  <span className="cartao-oficio-simbolo">
                    <IconeDeServico categoria={nome} tamanho={18} />
                  </span>
                  <span className="cartao-oficio-nome">{nome}</span>
                  {/* "Opções" e não "profissionais": na mesma fileira
                      convivem o eletricista e a farmácia, e chamar uma
                      farmácia de "1 profissional" é a frase errada bem no
                      cartão que existe para o comércio aparecer.

                      O singular vem escrito à parte: "1 opções" é o erro
                      que denuncia número montado por concatenação, e em
                      cidade pequena quase toda categoria começa no
                      singular. */}
                  <span className="cartao-oficio-quantos">
                    {quantosPorOficio.get(nome) === 1 ? "1 opção" : `${quantosPorOficio.get(nome)} opções`}
                  </span>
                </button>
              ))
            )}
          </Prateleira>

          {/* A saída de quem não achou o ofício em nenhuma prateleira, e a
              instrução depois dela: quem já sabe o que quer toca num cartão
              sem ler nada. */}
          <Link to="/categorias" className="btn btn-outline categorias-ver-mais">
            Ver todas as categorias
          </Link>
          <p className="muted categorias-dica">
            Ou digite o serviço ali em cima — a busca vai além destes.
          </p>
        </div>
      )}

      {/* A volta. Fica acima dos resultados e antes de qualquer cartão,
          porque é o primeiro lugar onde o olho procura depois de perceber
          que caiu numa lista errada — e porque no celular ela precisa
          caber na mesma tela que o primeiro resultado, senão continua
          sendo uma saída que só existe para quem rola atrás dela. */}
      {buscouAlgo && (
        <div className="busca-ativa">
          <span className="busca-ativa-alvo">
            {category ? category : `“${debouncedText.trim()}”`}
          </span>
          <button type="button" className="busca-ativa-limpar" onClick={verTodosOsServicos}>
            Ver todos os serviços
          </button>
        </div>
      )}

      {/* Quando a busca foi traduzida, a tradução aparece.
          Quem digita "consertar chuveiro" e recebe uma lista de
          eletricistas sem explicação fica na dúvida se o app entendeu ou se
          errou — e a dúvida faz voltar e digitar de novo. Dizer qual ofício
          foi entendido resolve as duas coisas: confirma o acerto e, quando
          erramos, mostra o erro em vez de escondê-lo atrás de uma lista
          estranha. Os nomes são tocáveis: quem quis o outro ofício chega
          nele com um toque. */}
      {buscouAlgo && oficiosDaNecessidade.length > 0 && (
        <p className="busca-traducao">
          Entendemos que você precisa de{" "}
          {oficiosDaNecessidade.map((oficio, i) => (
            <span key={oficio}>
              {i > 0 && (i === oficiosDaNecessidade.length - 1 ? " ou " : ", ")}
              <button type="button" className="busca-traducao-oficio" onClick={() => buscarOficio(oficio)}>
                {oficio}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      {buscouAlgo && (
      <div
        className="grid"
        data-tour="resultados"
        style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        {loading && <p className="muted">Buscando…</p>}
        {!loading && erroBusca !== "" && results.length === 0 && (
          /* Erro é diferente de vazio, e a diferença importa: aqui o app
             está admitindo que o problema é dele, e a saída é tentar de
             novo — não indicar alguém. */
          <div className="card">
            <strong>A busca não funcionou agora.</strong>
            <p className="muted" style={{ margin: "6px 0 12px" }}>{erroBusca}</p>
            <button className="btn btn-outline" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
          </div>
        )}
        {!loading && erroBusca === "" && results.length === 0 && (
          /* Busca vazia é o momento mais informativo do app: a pessoa acabou
             de dizer o que precisa e não achou. Sem isto ela só ia embora, e
             a informação — o que falta na cidade e quem poderia preencher —
             ia junto. */
          <div className="card vazio-indicar">
            <strong>Não achamos ninguém com esses filtros.</strong>
            <button className="btn btn-primary" onClick={() => setIndicarAberto(true)}>
              Indicar um profissional
            </button>
            {/* Explicação embaixo do botão: o título já diz o que houve, e
                quem chegou aqui quer saber o que fazer, não ler primeiro. */}
            <p className="muted">
              Tente outra categoria ou tire o filtro de nota. E se você conhece alguém que faz esse serviço,
              indique — a gente convida.
            </p>
          </div>
        )}
        {results.map((p) => (
          <CartaoProfissional key={p.id} p={p} />
        ))}
      </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          {/* Falha do "ver mais" fica aqui embaixo, junto do botão que
              falhou, e não no lugar da lista: o que já carregou continua
              valendo e a pessoa está lendo. */}
          {erroBusca !== "" && results.length > 0 && (
            <p className="muted" style={{ marginBottom: 10 }}>{erroBusca}</p>
          )}
          <button className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Ver mais profissionais"}
          </button>
        </div>
      )}

    </div>
  );
}

/**
 * "Casa e obra" → "casa-e-obra", para o chip do topo achar a prateleira.
 *
 * Um `id` de HTML com acento e espaço funciona nos navegadores de hoje, mas
 * quebra no `href="#..."` assim que alguém escrever o link à mão ou copiar
 * o endereço — e "Saúde e exames" tem os dois problemas na mesma palavra.
 */
function idDoGrupo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
