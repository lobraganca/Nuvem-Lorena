import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CATEGORIES, CITIES, DEFAULT_CITY } from "../types/domain";
import {
  DEFAULT_PAGE_SIZE,
  getActiveSponsorship,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type ProfessionalWithRating,
  type SortOption,
} from "../lib/professionals";
import type { CategorySponsorship, Professional } from "../types/domain";
import { hasDatabase } from "../lib/supabase";
import { FavoriteButton } from "../components/FavoriteButton";
import { TourGuide, type TourStep } from "../components/TourGuide";
import { hasSeenWelcome, markTourSeen, shouldRunTour } from "../lib/onboarding";
import { useOnlineCount } from "../lib/presence";

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
    text: "Autônomos e empresas na mesma lista, com a nota e as etiquetas que receberam. O selo ✓ Verificado indica cadastro conferido — é um sinal de compromisso, não uma garantia do serviço.",
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
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [category, setCategory] = useState<string>("");
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
  // Quem nunca viu a tela de início é mandado para lá antes da busca.
  const [redirectToWelcome] = useState(() => !hasSeenWelcome());
  const online = useOnlineCount();

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

  useEffect(() => {
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
  }, [city, category, debouncedText, minRating, sort]);

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

      <section style={{ padding: "40px 0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 6.2vw, 2rem)", lineHeight: 1.2, marginBottom: 10 }}>
          Quem você procura hoje, em {DEFAULT_CITY}
        </h1>
        <p className="muted">
          Cada serviço fechado por aqui é dinheiro que fica na cidade. Encontre pelo nome, pela categoria ou
          pela avaliação de quem já contratou.
        </p>
        {online !== null && online > 0 && (
          <p className="online-pill">
            <span className="online-dot" aria-hidden="true" />
            {online === 1 ? "1 pessoa navegando agora" : `${online} pessoas navegando agora`}
          </p>
        )}
        {!hasDatabase() && (
          <p className="badge badge-boosted" style={{ marginTop: 12 }}>
            Ambiente de demonstração — configure VITE_SUPABASE_URL/ANON_KEY para dados reais
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
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
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

      <div
        className="grid"
        data-tour="resultados"
        style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && (
          <p className="muted">Não achamos ninguém com esses filtros. Tente outra categoria ou tire o filtro de nota.</p>
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
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: p.entity_type === "pj" ? 10 : "50%",
                      border: "1px solid var(--color-border)",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    className="avatar-fallback"
                    style={{ borderRadius: p.entity_type === "pj" ? 10 : "50%" }}
                  >
                    {p.entity_type === "pj" ? "🏢" : "👤"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {boosted && <span className="badge badge-boosted">Destaque</span>}
                      <FavoriteButton professionalId={p.id} />
                    </div>
                  </div>
                  <p className="muted" style={{ margin: "4px 0" }}>
                    {p.category}
                    {(p.categories?.length ?? 0) > 1 && ` +${p.categories.length - 1}`} · {p.city}
                  </p>
                  <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                    {p.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
                  </span>
                  {p.entity_type === "pj" && p.responsible_name && (
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>Responsável: {p.responsible_name}</p>
                  )}
                </div>
              </div>
              {verified && <span className="badge badge-verified" style={{ marginTop: 8 }}>✓ Verificado</span>}
              <p style={{ marginTop: 10 }}>
                {p.average_rating ? (
                  <span className="stars">{"★".repeat(Math.round(p.average_rating))}</span>
                ) : (
                  <span className="muted">Sem avaliações</span>
                )}{" "}
                {p.review_count > 0 && <span className="muted">({p.review_count})</span>}
              </p>
              <span className="card-cta">Ver contatos e avaliações →</span>
            </Link>
          );
        })}
      </div>

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
