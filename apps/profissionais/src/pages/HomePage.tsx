import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { DEFAULT_CITY } from "../types/domain";
import {
  DEFAULT_PAGE_SIZE,
  getActiveSponsorship,
  getCategoriasComAnuncio,
  getCategoriasPopulares,
  getCidadesComAnuncio,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type ProfessionalWithRating,
  type SortOption,
} from "../lib/professionals";
import type { CategorySponsorship, Professional } from "../types/domain";
import { hasDatabase, problemaDeConfiguracao } from "../lib/supabase";
import { FavoriteButton } from "../components/FavoriteButton";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { FaixaDeBanners } from "../components/FaixaDeBanners";
import { Estrelas } from "../components/Estrelas";
import { TourGuide, type TourStep } from "../components/TourGuide";
import { hasSeenWelcome, markTourSeen, shouldRunTour } from "../lib/onboarding";
import { temDestinoLogin } from "../lib/auth";
import { useOnlineCount } from "../lib/presence";
import { useAuth } from "../lib/useAuth";
import { BottomSheet } from "../components/BottomSheet";
import { enviarIndicacao } from "../lib/indicacoes";
import { formatPhone } from "../lib/phone";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Iniciais em cor, no lugar do bonequinho genérico.
 *
 * Sem foto, todos os anúncios ficavam idênticos — a mesma silhueta cinza
 * repetida na lista inteira, que é o oposto do que um cartão de visita
 * precisa fazer. As iniciais distinguem à primeira vista, e a cor vem do
 * próprio nome, então é sempre a mesma para a mesma pessoa.
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corDoNome(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i) * (i + 1)) % 360;
  // Saturação e luminosidade fixas: a variação é só de matiz, para nenhuma
  // combinação sair berrante nem apagada ao lado das outras.
  return `hsl(${soma} 42% 42%)`;
}

/**
 * Passos do tour de primeiro acesso. Cada um aponta para um pedaço real da
 * tela (`data-tour`) — se o elemento não estiver visível, o passo vira um
 * cartão centralizado e o texto ainda se sustenta sozinho.
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: "filtros",
    title: "Comece pela categoria",
    text: `Escolha o serviço e a cidade. Dá para refinar por nota mínima e ordenar por melhor avaliado — em ${DEFAULT_CITY} ou nas cidades vizinhas.`,
  },
  {
    target: "resultados",
    title: "Quem aparece aqui",
    text: "Autônomos e empresas na mesma lista, com a nota e as etiquetas que receberam. O selo Premium indica quem assina o plano pago — não é avaliação nossa; quem diz se o trabalho é bom são as avaliações.",
  },
  {
    target: "nav-favoritos",
    title: "Guarde para depois",
    text: "O coração salva o profissional nos seus favoritos, para você não perder o contato de quem atendeu bem.",
  },
  {
    target: "nav-painel",
    title: "Você também presta serviço?",
    text: "No Painel você cria seu próprio anúncio, como pessoa física ou empresa. É grátis — o selo e o destaque são opcionais.",
  },
];

export function HomePage() {
  useTituloDaPagina();
  const [city, setCity] = useState<string>("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasPopulares, setCategoriasPopulares] = useState<string[]>([]);
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
  const [sponsorship, setSponsorship] = useState<(CategorySponsorship & { professional: Professional }) | null>(null);
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
    return !voltandoDoLogin && !temDestinoLogin() && !hasSeenWelcome();
  });
  const online = useOnlineCount();
  const { user } = useAuth();
  const [indicarAberto, setIndicarAberto] = useState(false);
  const [indNome, setIndNome] = useState("");
  const [indContato, setIndContato] = useState("");
  const [indSaving, setIndSaving] = useState(false);
  const [indEnviada, setIndEnviada] = useState(false);
  const [indErro, setIndErro] = useState("");

  useEffect(() => {
    getCidadesComAnuncio().then(setCidades);
    // O filtro de serviços vem dos cadastros, não da lista fixa do código:
    // quem escreveu o próprio ofício no anúncio precisa ser encontrável por
    // ele, e serviço sem ninguém anunciando só levaria a uma tela vazia.
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
     assim que a tela abre lotava a entrada com anúncio, sem a pessoa ter
     pedido nada ainda. */
  const buscouAlgo = debouncedText.trim() !== "" || category !== "";

  useEffect(() => {
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
    })
      .then((data) => {
        setResults(data);
        setHasMore(data.length === DEFAULT_PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }, [buscouAlgo, city, category, debouncedText, minRating, sort]);

  // Banner de categoria patrocinada: só aparece quando a busca está
  // filtrada por uma categoria específica.
  useEffect(() => {
    if (!category) {
      setSponsorship(null);
      return;
    }
    getActiveSponsorship(category, city || DEFAULT_CITY).then(setSponsorship);
  }, [category, city]);

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
        <span>
          <strong>Você presta serviço?</strong> Cadastre-se e apareça nas buscas — é grátis.
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
        <p className="muted">Profissionais de {DEFAULT_CITY} e região, com avaliação de quem já contratou.</p>
        {online !== null && online > 0 && (
          <p className="online-pill">
            <span className="online-dot" aria-hidden="true" />
            {online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
          </p>
        )}
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
                Anotado. Indicação de quem já conhece o trabalho vale mais que qualquer anúncio — é assim que
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

      {sponsorship && (
        <Link
          to={`/profissional/${sponsorship.professional.id}`}
          className="card"
          style={{
            marginTop: 24,
            display: "flex",
            gap: 16,
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
            border: "1px solid var(--color-primary)",
            background: "linear-gradient(135deg, var(--color-gold-tint), var(--color-surface))",
          }}
        >
          {sponsorship.professional.photo_url ? (
            <img
              src={sponsorship.professional.photo_url}
              alt={sponsorship.professional.name}
              style={{
                width: 72,
                height: 72,
                objectFit: "cover",
                borderRadius: sponsorship.professional.entity_type === "pj" ? 12 : "50%",
                border: "1px solid var(--color-border)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              className="avatar-fallback"
              style={{ width: 72, height: 72, fontSize: "1.8rem", borderRadius: sponsorship.professional.entity_type === "pj" ? 12 : "50%" }}
            >
              {sponsorship.professional.entity_type === "pj" ? "🏢" : "👤"}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span className="badge badge-boosted">Destaque patrocinado</span>
            <h3 style={{ margin: "6px 0 0" }}>{sponsorship.professional.name}</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {sponsorship.professional.category} · {sponsorship.professional.city}
            </p>
          </div>
          <span className="btn btn-primary">Ver perfil</span>
        </Link>
      )}

      {/* A publicidade fica entre os filtros e os resultados: é onde o olho
          passa de qualquer jeito, sem empurrar o que a pessoa veio buscar
          para fora da tela nem se disfarçar de resultado. */}
      <FaixaDeBanners cidade={city || DEFAULT_CITY} categoria={category} />

      {!buscouAlgo && (
        /* Nada foi pedido ainda: nenhum card, e sim um convite a pedir.
           Fica no lugar onde os resultados vão aparecer, para não somar
           altura à tela e depois encolher quando a busca chegar. */
        <div className="card vazio-indicar" data-tour="resultados" style={{ marginTop: 24, textAlign: "center" }}>
          <strong>O que você está procurando?</strong>
          <p className="muted">Digite um serviço ali em cima, ou toque numa das buscas mais comuns.</p>
          {categoriasPopulares.length > 0 && (
            /* "Mais comuns" é a contagem real de quem está anunciado, não
               opinião nem lista fixa no código — não existe registro de
               termo mais buscado, e sugerir uma categoria vazia devolveria
               "não achamos ninguém" no primeiro toque (ver
               getCategoriasPopulares). */
            <div className="chip-list" style={{ justifyContent: "center", marginTop: 14 }}>
              {categoriasPopulares.map((c) => (
                <button key={c} type="button" className="chip" onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {buscouAlgo && (
      <div
        className="grid"
        data-tour="resultados"
        style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && (
          /* Busca vazia é o momento mais informativo do app: a pessoa acabou
             de dizer o que precisa e não achou. Sem isto ela só ia embora, e
             a informação — o que falta na cidade e quem poderia preencher —
             ia junto. */
          <div className="card vazio-indicar">
            <strong>Não achamos ninguém com esses filtros.</strong>
            <p className="muted">
              Tente outra categoria ou tire o filtro de nota. E se você conhece alguém que faz esse serviço,
              indique — a gente convida.
            </p>
            <button className="btn btn-primary" onClick={() => setIndicarAberto(true)}>
              Indicar um profissional
            </button>
          </div>
        )}
        {results.map((p) => {
          const verified = isCurrentlyVerified(p);
          const boosted = isCurrentlyBoosted(p);
          return (
            <Link key={p.id} to={`/profissional/${p.id}`} className="card card-pro" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="card-foto"
                    style={{ borderRadius: p.entity_type === "pj" ? 14 : "50%" }}
                  />
                ) : (
                  <div
                    className="avatar-iniciais card-foto"
                    style={{
                      borderRadius: p.entity_type === "pj" ? 14 : "50%",
                      background: corDoNome(p.name),
                    }}
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
                      categoria: é o que decide entre dois anúncios do mesmo
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
                    {boosted && <span className="badge badge-boosted">Destaque</span>}
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
                  /* "Sem avaliações" lia como defeito do anúncio. Quem acabou
                     de se cadastrar não tem culpa de ainda não ter sido
                     avaliado — e o convite ainda serve a quem está lendo. */
                  <span className="muted">Novo por aqui — seja o primeiro a avaliar</span>
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
