import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES, CITIES, DEFAULT_CITY } from "../types/domain";
import {
  DEFAULT_PAGE_SIZE,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type ProfessionalWithRating,
  type SortOption,
} from "../lib/professionals";
import { hasDatabase } from "../lib/supabase";
import { FavoriteButton } from "../components/FavoriteButton";
import { BottomSheet } from "../components/BottomSheet";

const ONBOARDING_KEY = "busca-itabirito-onboarding-visto";

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
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Debounce (~400ms) do texto digitado antes de disparar a busca, para não
  // gerar uma query por tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text), 400);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  function dismissOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
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

  return (
    <div className="container">
      {showOnboarding && (
        <BottomSheet title="Bem-vindo ao Busca Itabirito" onClose={dismissOnboarding}>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, display: "grid", gap: 8 }}>
            <li>Encontre profissionais de confiança em Itabirito e região, com avaliações reais de quem já contratou.</li>
            <li>
              O selo <strong>✓ Verificado</strong> indica que o profissional assinou a verificação da plataforma — não é uma
              garantia de qualidade do serviço.
            </li>
            <li>
              Somos só uma plataforma de intermediação: a contratação, o combinado e o pagamento são diretamente entre você e o
              profissional. Veja os <Link to="/termos" onClick={dismissOnboarding}>Termos de Uso</Link>.
            </li>
            <li>Encontrou algo suspeito? Dá para denunciar um anúncio direto na página dele.</li>
          </ul>
          <button className="btn btn-gold btn-block" onClick={dismissOnboarding}>
            Entendi
          </button>
        </BottomSheet>
      )}

      <section style={{ padding: "40px 0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>
          Encontre profissionais de confiança em {DEFAULT_CITY}
        </h1>
        <p className="muted">Avaliações reais, selo de verificação e busca por categoria e cidade.</p>
        {!hasDatabase() && (
          <p className="badge badge-boosted" style={{ marginTop: 12 }}>
            Ambiente de demonstração — configure VITE_SUPABASE_URL/ANON_KEY para dados reais
          </p>
        )}
      </section>

      <div className="card" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Todas as cidades</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input placeholder="Buscar por nome ou palavra-chave" value={text} onChange={(e) => setText(e.target.value)} />
        <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
          <option value={0}>Qualquer nota</option>
          <option value={4}>4+ estrelas</option>
          <option value={3}>3+ estrelas</option>
          <option value={2}>2+ estrelas</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
          <option value="relevance">Mais relevante</option>
          <option value="rating">Melhor avaliado</option>
          <option value="reviews">Mais avaliações</option>
        </select>
      </div>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && (
          <p className="muted">Nenhum profissional encontrado com esses filtros ainda.</p>
        )}
        {results.map((p) => {
          const verified = isCurrentlyVerified(p);
          const boosted = isCurrentlyBoosted(p);
          const whatsappLink = p.phone && verified ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : null;
          return (
            <Link key={p.id} to={`/profissional/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
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
                    {p.category} · {p.city}
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
              {whatsappLink ? (
                <a
                  className="btn btn-teal"
                  style={{ marginTop: 10 }}
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Chamar no WhatsApp
                </a>
              ) : (
                p.phone && (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Telefone: {p.phone}
                  </p>
                )
              )}
            </Link>
          );
        })}
      </div>

      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
