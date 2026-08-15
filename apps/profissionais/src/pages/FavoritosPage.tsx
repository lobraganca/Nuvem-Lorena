import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Estrelas } from "../components/Estrelas";
import { getFavoriteProfessionals, type ProfessionalWithRating } from "../lib/professionals";
import { FavoriteButton } from "../components/FavoriteButton";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { corDoNome, iniciais } from "../lib/avatar";

export function FavoritosPage() {
  useTituloDaPagina("Meus favoritos");
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
            <Link key={p.id} to={`/profissional/${p.id}`} className={`card card-pro ${p.entity_type === "pj" ? "card-pro-pj" : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="card-foto" />
                ) : (
                  /* As mesmas iniciais coloridas da busca. Aqui era um emoji
                     cinza em caixa clara: o mesmo cadastro aparecia de um
                     jeito na busca e de outro nos favoritos, e sobre o
                     cartão teal da empresa a caixa clara ficava como um
                     furo no meio do cartão. */
                  <div
                    className="avatar-iniciais card-foto"
                    style={{ background: corDoNome(p.name) }}
                    aria-hidden="true"
                  >
                    {iniciais(p.name)}
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
                  {p.especialidade && <p className="card-especialidade">{p.especialidade}</p>}
                  {/* Dentro da coluna de texto e embrulhado em `.card-selos`,
                      como na busca. Solto como filho direto do cartão, o selo
                      ficava fora da coluna, alinhado com a foto e sem o
                      respiro de cima — era o que fazia este cartão parecer
                      quebrado ao lado do da busca. */}
                  <div className="card-selos">
                    {p.verified && (
                      <span className="badge badge-selo">
                        <VerifiedBadge size={14} /> Premium
                      </span>
                    )}
                    <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                      {p.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
                    </span>
                  </div>
                </div>
              </div>
              <p style={{ marginTop: 10 }}>
                {p.average_rating ? (
                  <Estrelas nota={p.average_rating} />
                ) : (
                  <span className="muted card-sem-nota">Sem avaliações</span>
                )}{" "}
                {p.review_count > 0 && <span className="muted">({p.review_count})</span>}
              </p>
              {/* Botão, e não link: o cartão inteiro já é um <Link>, e
                  HTML não permite um <a> dentro de outro. O navegador não
                  reclama — ele "conserta" fechando o cartão antes do botão,
                  que então escapa do cartão e vira uma célula própria da
                  grade. Era o borrão verde gigante no meio dos favoritos. */}
              {whatsappLink && (
                <button
                  type="button"
                  className="btn btn-teal"
                  style={{ marginTop: 10 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(whatsappLink, "_blank", "noreferrer");
                  }}
                >
                  Chamar no WhatsApp
                </button>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
