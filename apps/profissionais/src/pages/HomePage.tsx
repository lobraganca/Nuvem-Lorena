import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { DEFAULT_CITY, simboloDoServico } from "../types/domain";
import {
  DEFAULT_PAGE_SIZE,
  getCategoriasComAnuncio,
  getCategoriasPopulares,
  getCidadesComAnuncio,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type CategoriaPopular,
  type ProfessionalWithRating,
  type SortOption,
} from "../lib/professionals";
import { hasDatabase, problemaDeConfiguracao } from "../lib/supabase";
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
  /**
   * A categoria pode chegar pelo endereço (`/?servico=Farmácia`), que é
   * como a tela de todas as categorias manda a escolha para cá — e também
   * o que permite mandar "olha os eletricistas daqui" por WhatsApp.
   *
   * O parâmetro é lido uma vez e apagado logo em seguida (ver o efeito
   * abaixo): daí para frente quem manda é o estado. Deixá-lo no endereço
   * faria um recarregar depois de a pessoa já ter mudado de ideia
   * ressuscitar a busca antiga.
   */
  const [category, setCategory] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("servico") ?? "";
  });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasPopulares, setCategoriasPopulares] = useState<CategoriaPopular[]>([]);
  const [text, setText] = useState<string>("");
  const [debouncedText, setDebouncedText] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [results, setResults] = useState<ProfessionalWithRating[]>([]);
  const [loading, setLoading] = useState(false);
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
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("servico")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    getCidadesComAnuncio().then(setCidades);
    // O filtro de serviços vem dos cadastros, não da lista fixa do código:
    // quem escreveu o próprio ofício no cadastro precisa ser encontrável por
    // ele, e serviço sem ninguém cadastrado só levaria a uma tela vazia.
    getCategoriasComAnuncio().then(setCategorias);
    getCategoriasPopulares().then(setCategoriasPopulares);
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
      return;
    }
    setLoading(true);
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
    });
  }, [buscouAlgo, city, category, debouncedText, minRating, sort]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
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
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Cidade">
            <option value="">Todas as cidades</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
                    setIndErro(
                      err instanceof Error ? err.message : "Não foi possível enviar agora."
                    );
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
        /* Nada foi pedido ainda: nenhum card, e sim um convite a pedir.
           Fica no lugar onde os resultados vão aparecer, para não somar
           altura à tela e depois encolher quando a busca chegar. */
        <div className="card vazio-indicar" data-tour="resultados" style={{ marginTop: 24, textAlign: "center" }}>
          <strong>O que você está procurando?</strong>

          {/* Uma grade só, e o comércio dentro dela.

              Chegou a ser duas — "Profissionais" e "Empresas e comércios",
              cada uma com seu título. A tela ficou partida: com poucos
              cadastros, cada metade virava três ou quatro cartões e uma
              linha pela metade, e o que era um bloco só passou a parecer
              dois pedaços soltos.

              A vaga do comércio agora é reservada na hora de montar a lista,
              não na hora de desenhar (ver getCategoriasPopulares): as
              categorias de empresa entram intercaladas com as de autônomo,
              em vez de disputarem por contagem — disputa que elas perdem
              sempre, porque autônomo é a maioria dos cadastros.

              Cada cartão é um destino: símbolo próprio para ser reconhecido
              antes de lido, nome do ofício, e quantos atendem aquilo hoje.
              Antes eram etiquetas do tamanho da palavra — alvo pequeno, e
              uma fileira de texto cinza que se lia como enfeite do aviso,
              não como o caminho para os resultados. */}
          {categoriasPopulares.length > 0 && (
            <div className="categorias-grade">
              {categoriasPopulares.map((c) => (
                <button
                  key={c.categoria}
                  type="button"
                  className="categoria-cartao"
                  onClick={() => setCategory(c.categoria)}
                >
                  <span className="categoria-simbolo" aria-hidden="true">
                    {simboloDoServico(c.categoria)}
                  </span>
                  <span className="categoria-nome">{c.categoria}</span>
                  {/* "Opções" e não "profissionais": na mesma grade convivem
                      o eletricista e a farmácia, e chamar uma farmácia de
                      "1 profissional" é a frase errada bem no cartão que
                      existe para o comércio aparecer. "Opção" serve para
                      pessoa e para lugar, e é o que a pessoa está mesmo
                      contando ali.

                      O singular vem escrito à parte: "1 opções" é o erro
                      que denuncia um número montado por concatenação, e em
                      cidade pequena quase toda categoria começa no
                      singular. */}
                  <span className="categoria-quantos">
                    {c.quantidade === 1 ? "1 opção" : `${c.quantidade} opções`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* A saída de quem não achou o ofício na grade. Oito cartões são
              os ofícios mais numerosos da cidade; quem procura costureira ou
              professor de música não está entre eles, e antes só lhe restava
              acertar a palavra no campo de busca ou abrir o filtro de
              serviços — uma lista alfabética dentro de um `select` de
              celular, que é onde a pessoa desiste.

              Botão, e não link de texto: é a segunda ação mais provável da
              tela, atrás só de tocar num cartão. */}
          {categoriasPopulares.length > 0 && (
            <Link to="/categorias" className="btn btn-outline categorias-ver-mais">
              Ver todas as categorias
            </Link>
          )}

          {/* A instrução vem depois do botão: quem já sabe o que quer toca
              num cartão sem ler nada, e quem não achou o ofício tem primeiro
              a lista completa — digitar é a terceira saída, não a segunda. */}
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

      {buscouAlgo && (
      <div
        className="grid"
        data-tour="resultados"
        style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && (
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
        {results.map((p) => {
          const verified = isCurrentlyVerified(p);
          const boosted = isCurrentlyBoosted(p);
          return (
            <Link key={p.id} to={`/profissional/${p.id}`} className={`card card-pro ${p.entity_type === "pj" ? "card-pro-pj" : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="card-foto" />
                ) : (
                  <div
                    className="avatar-iniciais card-foto"
                    style={{ background: corDoNome(p.name) }}
                    aria-hidden="true"
                  >
                    {iniciais(p.name)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <h3 className="card-nome">{p.name}</h3>
                    <FavoriteButton professionalId={p.id} />
                  </div>
                  <p className="muted" style={{ margin: "4px 0" }}>
                    {p.category}
                    {(p.categories?.length ?? 0) > 1 && ` +${p.categories.length - 1}`} · {p.city}
                  </p>
                  {/* A especialidade vem numa linha só dela, e não colada na
                      categoria: é o que decide entre dois cadastros do mesmo
                      ofício, e emendada no "Dentista · Itabirito" ela viraria
                      mais uma palavra numa linha que ninguém termina de ler. */}
                  {p.especialidade && <p className="card-especialidade">{p.especialidade}</p>}
                  {/* Selo e destaque numa fila própria, embaixo. Ao lado do
                      nome, eles disputavam a mesma linha com o coração e
                      empurravam tudo para fora da tela — e o nome, que é o
                      que a pessoa lê primeiro, quebrava em duas linhas para
                      caber. A roseta some daqui: com a etiqueta escrita ao
                      lado, eram dois "verificado" no mesmo cartão. */}
                  <div className="card-selos">
                    {verified && (
                      <span className="badge badge-selo">
                        <VerifiedBadge size={14} /> Premium
                      </span>
                    )}
                    {boosted && <span className="badge badge-boosted">Em destaque</span>}
                    <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                      {p.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
                    </span>
                  </div>
                  {p.entity_type === "pj" && p.responsible_name && (
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>Responsável: {p.responsible_name}</p>
                  )}
                </div>
              </div>
              <p style={{ marginTop: 10 }}>
                {p.average_rating ? (
                  <>
                    <Estrelas nota={p.average_rating} />{" "}
                    <strong>{p.average_rating.toFixed(1).replace(".", ",")}</strong>{" "}
                    <span className="muted">({p.review_count})</span>
                  </>
                ) : (
                  /* "Sem avaliações" lia como defeito do cadastro. Quem acabou
                     de se cadastrar não tem culpa de ainda não ter sido
                     avaliado — e o convite ainda serve a quem está lendo. */
                  <span className="muted card-sem-nota">Novo por aqui — seja o primeiro a avaliar</span>
                )}
              </p>
              <span className="card-cta">Ver contatos e avaliações →</span>
            </Link>
          );
        })}
      </div>
      )}

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Ver mais profissionais"}
          </button>
        </div>
      )}

    </div>
  );
}
