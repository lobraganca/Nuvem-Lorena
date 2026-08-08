import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES, CITIES, DEFAULT_CITY } from "../types/domain";
import { searchProfessionals, type ProfessionalWithRating } from "../lib/professionals";
import { hasDatabase } from "../lib/supabase";

export function HomePage() {
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [category, setCategory] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [results, setResults] = useState<ProfessionalWithRating[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    searchProfessionals({ city: city || undefined, category: category || undefined, text: text || undefined })
      .then(setResults)
      .finally(() => setLoading(false));
  }, [city, category, text]);

  return (
    <div className="container">
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
      </div>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && (
          <p className="muted">Nenhum profissional encontrado com esses filtros ainda.</p>
        )}
        {results.map((p) => {
          const whatsappLink = p.phone ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : null;
          return (
            <Link key={p.id} to={`/profissional/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                {p.boosted && <span className="badge badge-boosted">Destaque</span>}
              </div>
              <p className="muted" style={{ margin: "4px 0" }}>
                {p.category} · {p.city}
              </p>
              {p.verified && <span className="badge badge-verified">✓ Verificado</span>}
              <p style={{ marginTop: 10 }}>
                {p.average_rating ? (
                  <span className="stars">{"★".repeat(Math.round(p.average_rating))}</span>
                ) : (
                  <span className="muted">Sem avaliações</span>
                )}{" "}
                {p.review_count > 0 && <span className="muted">({p.review_count})</span>}
              </p>
              {whatsappLink && (
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
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
