import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Estrelas } from "../components/Estrelas";
import { getFavoriteProfessionals, type ProfessionalWithRating } from "../lib/professionals";
import { FavoriteButton } from "../components/FavoriteButton";
import { useAuth } from "../lib/useAuth";

export function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<ProfessionalWithRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getFavoriteProfessionals(user.id)
      .then(setResults)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Meus favoritos</h1>

      {!authLoading && !user && (
        <p className="muted">
          Faça <Link to="/login">login</Link> para favoritar profissionais e vê-los aqui.
        </p>
      )}

      {user && !loading && results.length === 0 && (
        /* Vazio com saída: quem chega aqui sem favoritos não errou nada, só
           ainda não guardou ninguém — e o caminho de volta é a busca. */
        <div className="card" style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <strong>Você ainda não guardou ninguém.</strong>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.45 }}>
            Toque no ♥ de um profissional para guardá-lo aqui. Serve para não perder o contato de quem atendeu
            bem — e para achar rápido da próxima vez.
          </p>
          <Link className="btn btn-primary" to="/">
            Procurar profissionais
          </Link>
        </div>
      )}

      {loading && <p className="muted">Carregando…</p>}

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {results.map((p) => {
          const whatsappLink = p.phone && p.verified ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : null;
          return (
            /* Mesmo cartão azul da busca: é a mesma pessoa nas duas telas, e
               ver um cartão branco aqui e um azul lá faria parecer outra
               coisa. */
            <Link key={p.id} to={`/profissional/${p.id}`} className="card card-pro" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    className="card-foto"
                    style={{ borderRadius: p.entity_type === "pj" ? 14 : "50%" }}
                  />
                ) : (
                  <div className="avatar-fallback card-foto" style={{ borderRadius: p.entity_type === "pj" ? 14 : "50%" }}>
                    {p.entity_type === "pj" ? "🏢" : "👤"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <h3 className="card-nome" style={{ margin: 0 }}>{p.name}</h3>
                    <FavoriteButton professionalId={p.id} initialFavorited />
                  </div>
                  <p className="muted" style={{ margin: "4px 0" }}>
                    {p.category} · {p.city}
                  </p>
                </div>
              </div>
              {p.verified && <VerifiedBadge />}
              <p style={{ marginTop: 10 }}>
                {p.average_rating ? (
                  <Estrelas nota={p.average_rating} />
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
