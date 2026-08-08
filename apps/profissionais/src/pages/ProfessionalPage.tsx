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
  isCurrentlyBoosted,
  isCurrentlyVerified,
  hasLeadBalance,
  consumeLeadCredit,
  aggregateReviewTags,
  type ProfessionalWithRating,
} from "../lib/professionals";
import { getProfile, saveCpf } from "../lib/profiles";
import { formatCpf, isValidCpf } from "../lib/documents";
import { REPORT_REASONS, tagsForRating, tagsPromptForRating, type Review } from "../types/domain";
import { useAuth } from "../lib/useAuth";
import { FavoriteButton } from "../components/FavoriteButton";
import { BottomSheet } from "../components/BottomSheet";

/**
 * Chave de localStorage usada como trava anti-spam best-effort para
 * denúncias anônimas (sem login): não impede um usuário decidido de limpar
 * o localStorage e denunciar de novo, mas reduz spam casual do mesmo
 * navegador. Ver limitação documentada no README.
 */
function reportedKey(professionalId: string) {
  return `busca-itabirito-denunciado-${professionalId}`;
}

export function ProfessionalPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [professional, setProfessional] = useState<ProfessionalWithRating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
  const [cpfSheetOpen, setCpfSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alreadyReportedLocally, setAlreadyReportedLocally] = useState(false);
  const [leadBalanceAvailable, setLeadBalanceAvailable] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

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
    if (!professional || professional.contact_mode !== "pay_per_lead") {
      setLeadBalanceAvailable(false);
      return;
    }
    hasLeadBalance(professional.id).then(setLeadBalanceAvailable);
  }, [professional]);

  async function handleWhatsappClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!professional || professional.contact_mode !== "pay_per_lead") return;
    e.preventDefault();
    setContactLoading(true);
    try {
      const ok = await consumeLeadCredit(professional.id);
      if (!ok) {
        setLeadBalanceAvailable(false);
        return;
      }
      window.open(`https://wa.me/${professional.phone.replace(/\D/g, "")}`, "_blank", "noreferrer");
    } finally {
      setContactLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    setAlreadyReportedLocally(!!window.localStorage.getItem(reportedKey(id)));
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
      setCpfSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o CPF.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Trocar a nota troca o conjunto de etiquetas oferecido (qualidades para
   * nota alta, problemas para nota baixa), então as etiquetas já marcadas
   * que não existem no conjunto novo são descartadas — senão daria para
   * enviar "Atrasou" numa avaliação 5 estrelas.
   */
  function changeRating(next: number) {
    setRating(next);
    const allowed = tagsForRating(next);
    setSelectedTags((tags) => tags.filter((t) => allowed.includes(t)));
  }

  function toggleTag(tag: string) {
    setSelectedTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id || !cpf) return;
    setSaving(true);
    setError("");
    try {
      // Nem etiqueta nem comentário são obrigatórios: só a nota basta.
      const payload = { rating, tags: selectedTags, comment: comment.trim() };
      if (editingReviewId) {
        await updateReview(editingReviewId, payload);
      } else {
        await addReview({ professional_id: id, user_id: user.id, ...payload });
      }
      setComment("");
      setSelectedTags([]);
      setRating(5);
      setEditingReviewId(null);
      setReviewSheetOpen(false);
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
    // Só pré-seleciona etiquetas que ainda pertencem ao conjunto da nota
    // salva (protege contra etiquetas antigas removidas da lista).
    const allowed = tagsForRating(r.rating);
    setSelectedTags((r.tags ?? []).filter((t) => allowed.includes(t)));
    setComment(r.comment);
    setError("");
    setReviewSheetOpen(true);
  }

  function cancelEditReview() {
    setEditingReviewId(null);
    setRating(5);
    setSelectedTags([]);
    setComment("");
    setError("");
    setReviewSheetOpen(false);
  }

  async function confirmRemoveReview() {
    if (!deleteConfirmId) return;
    const reviewId = deleteConfirmId;
    try {
      await deleteReview(reviewId);
      if (editingReviewId === reviewId) cancelEditReview();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a avaliação.");
    } finally {
      setDeleteConfirmId(null);
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
      if (!user) {
        window.localStorage.setItem(reportedKey(id), "1");
        setAlreadyReportedLocally(true);
      }
      setReportSent(true);
      setReportDetails("");
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        setReportError("Você já tem uma denúncia em aberto para este anúncio.");
      } else {
        setReportError(err instanceof Error ? err.message : "Não foi possível enviar a denúncia.");
      }
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

  const verified = isCurrentlyVerified(professional);
  const boosted = isCurrentlyBoosted(professional);
  // Resumo de reputação: as etiquetas mais recebidas por este profissional.
  const topTags = aggregateReviewTags(reviews);
  const payPerLead = professional.contact_mode === "pay_per_lead";
  const whatsappBlocked = payPerLead && !leadBalanceAvailable;
  const whatsappLink =
    professional.phone && verified && !whatsappBlocked ? `https://wa.me/${professional.phone.replace(/\D/g, "")}` : null;

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "start" }}>
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt={professional.name}
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
            {verified && <span className="badge badge-verified">✓ Verificado</span>}
            {boosted && <span className="badge badge-boosted">Destaque</span>}
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
          <a
            className="btn btn-teal"
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleWhatsappClick}
            aria-disabled={contactLoading}
          >
            {contactLoading ? "Abrindo…" : "Chamar no WhatsApp"}
          </a>
        ) : whatsappBlocked ? (
          <p className="muted">Este profissional está sem créditos de contato no momento.</p>
        ) : (
          professional.phone && <p className="muted">Telefone: {professional.phone}</p>
        )}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>Avaliações</h2>

        {topTags.length > 0 && (
          <div style={{ margin: "0 0 18px" }}>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.82rem" }}>
              O que as pessoas mais falam
            </p>
            <div className="chip-list">
              {topTags.map(({ tag, count }) => (
                <span key={tag} className="chip chip-sm chip-static chip-tally">
                  {tag} <span className="chip-count">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {!user && <p className="muted">Faça login com sua conta Google para avaliar este profissional.</p>}

        {user && !cpfLoading && !cpf && (
          <button className="btn btn-gold" onClick={() => setCpfSheetOpen(true)} style={{ marginBottom: 20 }}>
            Confirmar CPF para avaliar
          </button>
        )}

        {user && cpf && !editingReviewId && (
          <button className="btn btn-gold" onClick={() => setReviewSheetOpen(true)} style={{ marginBottom: 20 }}>
            Enviar avaliação
          </button>
        )}

        {cpfSheetOpen && (
          <BottomSheet
            title="Confirmar CPF"
            subtitle="Ele fica associado à sua conta Google e é usado só para evitar avaliações falsas — não aparece publicamente."
            onClose={() => setCpfSheetOpen(false)}
          >
            <form onSubmit={confirmCpf} style={{ display: "grid", gap: 14 }}>
              <input
                placeholder="000.000.000-00"
                value={cpfInput}
                onChange={(e) => setCpfInput(formatCpf(e.target.value))}
                inputMode="numeric"
                maxLength={14}
              />
              {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
              <button className="btn btn-gold btn-block" type="submit" disabled={saving}>
                {saving ? "Confirmando…" : "Confirmar CPF"}
              </button>
            </form>
          </BottomSheet>
        )}

        {reviewSheetOpen && (
          <BottomSheet
            title={editingReviewId ? "Editar avaliação" : "Enviar avaliação"}
            subtitle="Toque nas estrelas e nas etiquetas que combinam. Não precisa escrever nada."
            onClose={cancelEditReview}
          >
            <form onSubmit={submitReview} style={{ display: "grid", gap: 16 }}>
              <div>
                <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.85rem" }}>
                  Sua nota
                </p>
                <div className="star-picker" role="group" aria-label="Nota de 1 a 5 estrelas">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n <= rating ? "star-btn star-btn-on" : "star-btn"}
                      onClick={() => changeRating(n)}
                      aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      aria-pressed={rating === n}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{tagsPromptForRating(rating)}</p>
                <div className="chip-list">
                  {tagsForRating(rating).map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={selected ? "chip chip-selected" : "chip"}
                        aria-pressed={selected}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label style={{ display: "grid", gap: 6, fontSize: "0.85rem" }} className="muted">
                Quer escrever algo? (opcional)
                <textarea
                  placeholder="Conte como foi o atendimento"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </label>
              {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
              <button className="btn btn-gold btn-block" type="submit" disabled={saving}>
                {saving ? "Enviando…" : editingReviewId ? "Salvar alterações" : "Enviar avaliação"}
              </button>
            </form>
          </BottomSheet>
        )}

        {deleteConfirmId && (
          <BottomSheet
            title="Excluir avaliação"
            subtitle="Essa ação não pode ser desfeita."
            onClose={() => setDeleteConfirmId(null)}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </button>
              <button className="btn btn-gold" onClick={confirmRemoveReview}>
                Excluir avaliação
              </button>
            </div>
          </BottomSheet>
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
                        onClick={() => setDeleteConfirmId(r.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
                {(r.tags ?? []).length > 0 && (
                  <div className="chip-list" style={{ marginTop: 8 }}>
                    {(r.tags ?? []).map((tag) => (
                      <span key={tag} className="chip chip-sm chip-static">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {r.comment?.trim() && <p style={{ margin: "8px 0 0" }}>{r.comment}</p>}

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
        {!reportOpen && !reportSent && !user && alreadyReportedLocally && (
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            Você já denunciou este anúncio neste navegador. Entre com sua conta para denunciar de novo se necessário.
          </p>
        )}
        {!reportOpen && !reportSent && (!alreadyReportedLocally || !!user) && (
          <button className="btn btn-outline" onClick={() => setReportOpen(true)} style={{ fontSize: "0.82rem" }}>
            Denunciar este anúncio
          </button>
        )}
        {reportSent && <p className="muted">Denúncia enviada. Obrigado — vamos analisar este anúncio.</p>}
        {reportOpen && !reportSent && (
          <BottomSheet
            title="Denunciar este anúncio"
            subtitle="Encontrou algo errado (informação falsa, golpe/fraude, conteúdo ofensivo)? Conte pra gente."
            onClose={() => setReportOpen(false)}
          >
            <form onSubmit={submitReport} style={{ display: "grid", gap: 14 }}>
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
              {reportError && <p style={{ color: "var(--color-danger)" }}>{reportError}</p>}
              <button className="btn btn-gold btn-block" type="submit" disabled={reportSaving}>
                {reportSaving ? "Enviando…" : "Enviar denúncia"}
              </button>
            </form>
          </BottomSheet>
        )}
      </section>

      <p className="muted" style={{ marginTop: 24, fontSize: "0.8rem" }}>
        Ao contratar, você concorda com os <Link to="/termos">Termos de Uso</Link> da plataforma.
      </p>
    </div>
  );
}
