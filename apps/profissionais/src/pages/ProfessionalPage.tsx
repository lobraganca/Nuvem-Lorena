import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  getProfessional,
  getReviews,
  addReview,
  updateReview,
  deleteReview,
  replyToReview,
  reportProfessional,
  getFavoriteIds,
  type ProfessionalWithRating,
} from "../lib/professionals";
import { getProfile, saveCpf } from "../lib/profiles";
import { formatCpf, isValidCpf } from "../lib/documents";
import { REPORT_REASONS, type Review } from "../types/domain";
import { useAuth } from "../lib/useAuth";
import { FavoriteButton } from "../components/FavoriteButton";

export function ProfessionalPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cpf, setCpf] = useState<string | null>(null);
  const [cpfInput, setCpfInput] = useState("");
  const [cpfLoading, setCpfLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) {
      setCpf(null);
      setCpfLoading(false);
      return;
    }
    setCpfLoading(true);
    getProfile(user.id)
      .then((profile) => setCpf(profile?.cpf ?? null))
      .finally(() => setCpfLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !id) {
      setIsFavorite(false);
      return;
    }
    getFavoriteIds(user.id).then((ids) => setIsFavorite(ids.has(id)));
  }, [user, id]);

  async function confirmCpf(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!isValidCpf(cpfInput)) {
      setError("CPF inválido. Confira os números digitados.");
      return;
    }
    setSaving(true);
    try {
      const digits = cpfInput.replace(/\D/g, "");
      await saveCpf(user.id, digits);
      setCpf(digits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o CPF.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id || !cpf) return;
    setSaving(true);
    setError("");
    try {
      if (editingReviewId) {
        await updateReview(editingReviewId, { rating, comment });
      } else {
        await addReview({ professional_id: id, user_id: user.id, rating, comment });
      }
      setComment("");
      setRating(5);
      setEditingReviewId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a avaliação.");
    } finally {
      setSaving(false);
    }
  }

  function startEditReview(r: Review) {
    setEditingReviewId(r.id);
    setRating(r.rating);
    setComment(r.comment);
    setError("");
  }

  function cancelEditReview() {
    setEditingReviewId(null);
    setRating(5);
    setComment("");
    setError("");
  }

  async function removeReview(reviewId: string) {
    if (!confirm("Excluir esta avaliação?")) return;
    try {
      await deleteReview(reviewId);
      if (editingReviewId === reviewId) cancelEditReview();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a avaliação.");
    }
  }

  async function submitReply(reviewId: string) {
    const reply = (replyDrafts[reviewId] ?? "").trim();
    if (!reply) return;
    setReplySavingId(reviewId);
    try {
      await replyToReview(reviewId, reply);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a resposta.");
    } finally {
      setReplySavingId(null);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setReportSaving(true);
    setReportError("");
    try {
      await reportProfessional({
        professional_id: id,
        reporter_id: user?.id ?? null,
        reason: reportReason,
        details: reportDetails,
      });
      setReportSent(true);
      setReportDetails("");
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Não foi possível enviar a denúncia.");
    } finally {
      setReportSaving(false);
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

  const whatsappLink =
    professional.phone && professional.verified
      ? `https://wa.me/${professional.phone.replace(/\D/g, "")}`
      : null;

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "start" }}>
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: professional.entity_type === "pj" ? 12 : "50%",
                  border: "1px solid var(--color-border)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                className="avatar-fallback"
                style={{ width: 72, height: 72, fontSize: "1.8rem", borderRadius: professional.entity_type === "pj" ? 12 : "50%" }}
              >
                {professional.entity_type === "pj" ? "🏢" : "👤"}
              </div>
            )}
            <div>
              <h1 style={{ margin: 0 }}>{professional.name}</h1>
              <p className="muted">
                {professional.category} · {professional.city}
              </p>
              <span className={professional.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                {professional.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
              </span>
              {professional.entity_type === "pj" && professional.responsible_name && (
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>Responsável: {professional.responsible_name}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
            {professional.verified && <span className="badge badge-verified">✓ Verificado</span>}
            {professional.boosted && <span className="badge badge-boosted">Destaque</span>}
            <FavoriteButton professionalId={professional.id} initialFavorited={isFavorite} size="large" />
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
        {whatsappLink ? (
          <a className="btn btn-teal" href={whatsappLink} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
          </a>
        ) : (
          professional.phone && <p className="muted">Telefone: {professional.phone}</p>
        )}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>Avaliações</h2>
        {!user && <p className="muted">Faça login com sua conta Google para avaliar este profissional.</p>}

        {user && !cpfLoading && !cpf && (
          <form className="card" onSubmit={confirmCpf} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <p className="muted" style={{ margin: 0 }}>
              Para avaliar, confirme seu CPF. Ele fica associado à sua conta Google e é usado só para evitar
              avaliações falsas — não aparece publicamente.
            </p>
            <input
              placeholder="000.000.000-00"
              value={cpfInput}
              onChange={(e) => setCpfInput(formatCpf(e.target.value))}
              inputMode="numeric"
              maxLength={14}
            />
            {error && <p style={{ color: "#e0665e" }}>{error}</p>}
            <button className="btn btn-gold" type="submit" disabled={saving}>
              {saving ? "Confirmando…" : "Confirmar CPF"}
            </button>
          </form>
        )}

        {user && cpf && (
          <form className="card" onSubmit={submitReview} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {editingReviewId && <p className="muted" style={{ margin: 0 }}>Editando sua avaliação</p>}
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
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-gold" type="submit" disabled={saving}>
                {saving ? "Enviando…" : editingReviewId ? "Salvar alterações" : "Enviar avaliação"}
              </button>
              {editingReviewId && (
                <button className="btn btn-outline" type="button" onClick={cancelEditReview}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}

        <div className="grid">
          {reviews.length === 0 && <p className="muted">Nenhuma avaliação ainda.</p>}
          {reviews.map((r) => {
            const isOwnReview = user?.id === r.user_id;
            const isOwner = user?.id === professional.owner_id;
            return (
              <div key={r.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <span className="stars">{"★".repeat(r.rating)}</span>
                  {isOwnReview && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                        onClick={() => startEditReview(r)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                        onClick={() => removeReview(r.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ margin: "6px 0 0" }}>{r.comment}</p>

                {r.reply && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingLeft: 12,
                      borderLeft: "2px solid var(--color-accent-teal)",
                    }}
                  >
                    <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>Resposta do profissional</p>
                    <p style={{ margin: "4px 0 0" }}>{r.reply}</p>
                  </div>
                )}

                {isOwner && !r.reply && (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <textarea
                      placeholder="Responder a esta avaliação"
                      rows={2}
                      value={replyDrafts[r.id] ?? ""}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: "0.8rem", justifySelf: "start" }}
                      onClick={() => submitReply(r.id)}
                      disabled={replySavingId === r.id}
                    >
                      {replySavingId === r.id ? "Enviando…" : "Responder"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        {!reportOpen && !reportSent && (
          <button className="btn btn-outline" onClick={() => setReportOpen(true)} style={{ fontSize: "0.82rem" }}>
            Denunciar este anúncio
          </button>
        )}
        {reportSent && <p className="muted">Denúncia enviada. Obrigado — vamos analisar este anúncio.</p>}
        {reportOpen && !reportSent && (
          <form className="card" onSubmit={submitReport} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
            <p className="muted" style={{ margin: 0 }}>
              Encontrou algo errado neste anúncio (informação falsa, golpe/fraude, conteúdo ofensivo)? Conte
              pra gente.
            </p>
            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Detalhes (opcional)"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
            />
            {reportError && <p style={{ color: "#e0665e" }}>{reportError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-gold" type="submit" disabled={reportSaving}>
                {reportSaving ? "Enviando…" : "Enviar denúncia"}
              </button>
              <button className="btn btn-outline" type="button" onClick={() => setReportOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      <p className="muted" style={{ marginTop: 24, fontSize: "0.8rem" }}>
        Ao contratar, você concorda com os <Link to="/termos">Termos de Uso</Link> da plataforma.
      </p>
    </div>
  );
}
