import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProfessional, getReviews, addReview, type ProfessionalWithRating } from "../lib/professionals";
import type { Review } from "../types/domain";
import { useAuth } from "../lib/useAuth";

export function ProfessionalPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!id) return;
    const [p, r] = await Promise.all([getProfessional(id), getReviews(id)]);
    setProfessional(p);
    setReviews(r);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id) return;
    setSaving(true);
    setError("");
    try {
      await addReview({ professional_id: id, user_id: user.id, rating, comment });
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a avaliação.");
    } finally {
      setSaving(false);
    }
  }

  if (!professional) {
    return (
      <div className="container">
        <p className="muted" style={{ marginTop: 40 }}>
          Profissional não encontrado (ou banco de dados de demonstração sem dados ainda).
        </p>
      </div>
    );
  }

  const whatsappLink = professional.phone
    ? `https://wa.me/${professional.phone.replace(/\D/g, "")}`
    : null;

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h1 style={{ margin: 0 }}>{professional.name}</h1>
            <p className="muted">
              {professional.category} · {professional.city}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {professional.verified && <span className="badge badge-verified">✓ Verificado</span>}
            {professional.boosted && <span className="badge badge-boosted">Destaque</span>}
          </div>
        </div>
        <p style={{ marginTop: 16 }}>{professional.bio || "Sem descrição."}</p>
        <p>
          {professional.average_rating ? (
            <>
              <span className="stars">{"★".repeat(Math.round(professional.average_rating))}</span>{" "}
              <strong>{professional.average_rating.toFixed(1)}</strong>{" "}
              <span className="muted">({professional.review_count} avaliações)</span>
            </>
          ) : (
            <span className="muted">Ainda sem avaliações</span>
          )}
        </p>
        {whatsappLink && (
          <a className="btn btn-teal" href={whatsappLink} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
          </a>
        )}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>Avaliações</h2>
        {user ? (
          <form className="card" onSubmit={submitReview} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <label>
              Nota
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} estrela{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              placeholder="Conte como foi o atendimento"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            {error && <p style={{ color: "#e0665e" }}>{error}</p>}
            <button className="btn btn-gold" type="submit" disabled={saving}>
              {saving ? "Enviando…" : "Enviar avaliação"}
            </button>
          </form>
        ) : (
          <p className="muted">Faça login para avaliar este profissional.</p>
        )}

        <div className="grid">
          {reviews.length === 0 && <p className="muted">Nenhuma avaliação ainda.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="card">
              <span className="stars">{"★".repeat(r.rating)}</span>
              <p style={{ margin: "6px 0 0" }}>{r.comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
