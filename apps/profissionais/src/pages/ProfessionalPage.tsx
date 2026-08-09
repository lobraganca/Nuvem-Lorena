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
  registrarContato,
  requestContact,
  type ProfessionalWithRating,
} from "../lib/professionals";
import { REPORT_REASONS, tagsForRating, tagsPromptForRating, type Review } from "../types/domain";
import { useAuth } from "../lib/useAuth";
import { FavoriteButton } from "../components/FavoriteButton";
import { BottomSheet } from "../components/BottomSheet";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Estrelas } from "../components/Estrelas";
import { formatPhone } from "../lib/phone";

/**
 * Chave de localStorage usada como trava anti-spam best-effort para
 * denúncias anônimas (sem login): não impede um usuário decidido de limpar
 * o localStorage e denunciar de novo, mas reduz spam casual do mesmo
 * navegador. Ver limitação documentada no README.
 */
/**
 * Como chamar quem anuncia, no meio de uma frase.
 *
 * Pessoa física atende pelo primeiro nome. Empresa, não: cortar "Elétrica
 * Souza" no primeiro espaço produz "Fale com Elétrica", que soa como erro do
 * app e deixa o anúncio com cara de amador — exatamente o oposto do que ele
 * está tentando comprar ali.
 */
function comoChamar(p: { name: string; entity_type: string }): string {
  if (p.entity_type === "pj") return p.name;
  return p.name.trim().split(" ")[0];
}

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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alreadyReportedLocally, setAlreadyReportedLocally] = useState(false);
  const [leadBalanceAvailable, setLeadBalanceAvailable] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSaving, setReqSaving] = useState(false);
  const [reqSent, setReqSent] = useState(false);
  const [reqError, setReqError] = useState("");
  /** Só usado onde o navegador não tem compartilhamento nativo (desktop). */
  const [copiado, setCopiado] = useState(false);

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

  /** Registra o contato para a etiqueta "avaliação de quem chamou". */
  function anotarContato(tipo: "whatsapp" | "telefone" | "pedido") {
    if (!id) return;
    void registrarContato(id, user?.id ?? null, tipo);
  }

  async function handleWhatsappClick(e: React.MouseEvent<HTMLAnchorElement>) {
    anotarContato("whatsapp");
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
    if (!user || !id) {
      setIsFavorite(false);
      return;
    }
    getFavoriteIds(user.id).then((ids) => setIsFavorite(ids.has(id)));
  }, [user, id]);


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
    if (!user || !id) return;
    // Nota baixa sem nenhuma etiqueta é um desabafo, não uma avaliação: não
    // diz ao profissional o que corrigir nem a quem lê o que esperar. Só
    // aqui a etiqueta é obrigatória — de 3 estrelas para cima, a nota basta.
    if (rating <= 2 && selectedTags.length === 0) {
      setError("Marque pelo menos o que deu errado, para a crítica ser útil a quem lê e a quem recebe.");
      return;
    }
    setSaving(true);
    setError("");
    try {
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

  async function submitContactRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!reqName.trim() || reqPhone.replace(/\D/g, "").length < 10) {
      setReqError("Precisamos do seu nome e de um telefone com DDD para a pessoa retornar.");
      return;
    }
    setReqSaving(true);
    setReqError("");
    try {
      await requestContact({
        professional_id: id,
        requester_id: user?.id ?? null,
        name: reqName.trim(),
        phone: reqPhone.trim(),
        message: reqMessage.trim(),
      });
      anotarContato("pedido");
      setReqSent(true);
    } catch (err) {
      setReqError(err instanceof Error ? err.message : "Não conseguimos enviar seu pedido agora.");
    } finally {
      setReqSaving(false);
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
          Não encontramos esse anúncio. Ele pode ter saído do ar.
        </p>
      </div>
    );
  }

  const verified = isCurrentlyVerified(professional);
  const boosted = isCurrentlyBoosted(professional);
  // Resumo de reputação: as etiquetas mais recebidas por este profissional.
  const topTags = aggregateReviewTags(reviews);
  const payPerLead = professional.contact_mode === "pay_per_lead";
  /**
   * O "pagar por contato" foi aposentado: a assinatura passou a liberar o
   * contato por preço fixo. Anúncios criados antes disso ficaram com o modo
   * antigo gravado e sem tela para trocá-lo — o WhatsApp deles sumiria para
   * sempre quando o saldo acabasse, sem que o dono pudesse fazer nada.
   * Tratar todo mundo como "WhatsApp livre" desfaz isso sem precisar mexer
   * no banco de quem já estava cadastrado.
   */
  const whatsappBlocked = false;
  void payPerLead;
  void leadBalanceAvailable;
  const zap = professional.whatsapp || professional.phone;
  const whatsappLink = zap && verified && !whatsappBlocked ? `https://wa.me/${zap.replace(/\D/g, "")}` : null;
  /**
   * Botão do WhatsApp e pedido de contato são o que a assinatura entrega a
   * quem anuncia. Sem ela, o telefone continua visível — escrito, para ser
   * anotado ou ligado — e é isso que mantém o app útil mesmo para quem nunca
   * pagou: quem procura sempre consegue chegar na pessoa.
   */
  const contatoFacilitado = verified;
  const instagramUrl = professional.instagram
    ? professional.instagram.startsWith("http")
      ? professional.instagram
      : `https://instagram.com/${professional.instagram.replace(/^@/, "")}`
    : null;

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
              {/* O selo vira parte do texto em vez de item de um flex: como
                  item, ele reservava largura fixa e espremia o nome numa
                  coluna de três linhas ("Maria / da / Silva"). */}
              <h1 className="perfil-nome">
                {professional.name} {verified && <VerifiedBadge size={20} />}
              </h1>
              <p className="muted">
                {professional.category} · {professional.city}
              </p>
              {/* Endereço só existe para quem tem ponto fixo. Quando existe,
                  é informação de primeira ordem — decide se dá para ir a pé. */}
              {(professional.street || professional.neighborhood) && (
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.88rem" }}>
                  📍{" "}
                  {[
                    [professional.street, professional.street_number].filter(Boolean).join(", "),
                    professional.neighborhood,
                  ]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
              {professional.entity_type === "pj" && professional.responsible_name && (
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>Responsável: {professional.responsible_name}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
            {boosted && <span className="badge badge-boosted">Destaque</span>}
            <FavoriteButton professionalId={professional.id} initialFavorited={isFavorite} size="large" />
          </div>
        </div>
        {/* Serviços e tipo de cadastro saem da coluna estreita ao lado da
            foto: ali cada etiqueta caía numa linha própria, e três serviços
            viravam três linhas de nada. Na largura toda, cabem lado a lado. */}
        <div className="chip-list chip-list-perfil">
          {(professional.categories ?? []).map((c) => (
            <span key={c} className="chip chip-static chip-sm">
              {c}
            </span>
          ))}
          <span className={professional.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
            {professional.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
          </span>
        </div>

        <p style={{ marginTop: 16 }}>{professional.bio || "Essa pessoa ainda não escreveu sobre o trabalho dela."}</p>
        <p>
          {professional.average_rating ? (
            <>
              <Estrelas nota={professional.average_rating} tamanho="1.05rem" />{" "}
              <strong>{professional.average_rating.toFixed(1).replace(".", ",")}</strong>{" "}
              <span className="muted">({professional.review_count} avaliações)</span>
            </>
          ) : (
            <span className="muted">Novo por aqui — seja o primeiro a avaliar</span>
          )}
        </p>
        <div className="contact-list">
          {whatsappLink && (
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
          )}
          {whatsappBlocked && (
            <p className="muted" style={{ width: "100%", margin: 0 }}>
              O WhatsApp deste anúncio está indisponível agora. Dá para ligar ou pedir que retornem.
            </p>
          )}
          {professional.phone && (
            <a
              className="contact-chip"
              href={`tel:${professional.phone.replace(/\D/g, "")}`}
              onClick={() => anotarContato("telefone")}
            >
              <span aria-hidden="true">📞</span> {formatPhone(professional.phone)}
            </a>
          )}
          {professional.email && (
            <a className="contact-chip" href={`mailto:${professional.email}`}>
              <span aria-hidden="true">✉️</span> {professional.email}
            </a>
          )}
          {instagramUrl && (
            <a className="contact-chip" href={instagramUrl} target="_blank" rel="noreferrer">
              <span aria-hidden="true">📷</span> Instagram
            </a>
          )}
          {professional.linkedin && (
            <a className="contact-chip" href={professional.linkedin} target="_blank" rel="noreferrer">
              <span aria-hidden="true">💼</span> LinkedIn
            </a>
          )}
          {professional.whatsapp_verified && (
            /* Diz QUAL número foi confirmado, e não apenas que houve
               confirmação. Quando WhatsApp e telefone são diferentes, só um
               deles passou pelo código — e um "✓ confirmado" solto faria a
               pessoa acreditar que os dois foram. */
            <span className="whats-ok" title="O dono do anúncio recebeu um código neste número e digitou de volta">
              ✓ {formatPhone(zap ?? "")} confirmado por código
            </span>
          )}
        </div>

        {contatoFacilitado ? (
          /* Deixou de ser azul cheio: com o WhatsApp verde logo acima, eram
             duas ações gritando ao mesmo tempo, e quando tudo grita nada é
             ouvido. O WhatsApp é o que a pessoa veio fazer; este é o plano B
             de quem não quer falar agora. */
          <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={() => setContactSheetOpen(true)}>
            Peça para {comoChamar(professional)} te chamar
          </button>
        ) : (
          /* Sem assinatura, o caminho é o telefone acima. Dito em uma linha,
             sem tom de bloqueio: quem lê é o cliente, e a mensagem não pode
             soar como se o profissional estivesse devendo algo. */
          <p className="muted" style={{ marginTop: 14, fontSize: "0.86rem", textAlign: "center" }}>
            Fale com {comoChamar(professional)} pelo telefone acima.
          </p>
        )}

        {/* Numa cidade, o app cresce no boca a boca — e boca a boca hoje é
            link colado no grupo da família. Sem isto, indicar alguém exige
            copiar o endereço da barra, que quase ninguém faz no celular. */}
        <button
          className="acao-discreta"
          onClick={async () => {
            const url = window.location.href;
            const texto = `${professional.name} — ${professional.category} em ${professional.city}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: professional.name, text: texto, url });
              } else {
                await navigator.clipboard.writeText(`${texto}\n${url}`);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              }
            } catch {
              // Cancelar o compartilhamento não é erro — a pessoa mudou de ideia.
            }
          }}
        >
          {copiado ? "Link copiado ✓" : "Indicar para alguém"}
        </button>
        {contatoFacilitado && (
          /* Só quando o botão de pedir retorno existe. Sem a assinatura ele
             não aparece, e esta frase ficava sozinha prometendo uma coisa que
             não estava em lugar nenhum da tela. */
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.84rem" }}>
            Sem tempo de ligar agora? Deixe seu número que a pessoa retorna.
          </p>
        )}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>Avaliações da vizinhança</h2>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.88rem" }}>
          Quem trabalha aqui depende da fama que constrói aqui. Se o serviço foi bom, sua avaliação é a melhor
          propaganda que essa pessoa vai ter.
        </p>

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

        {!user && <p className="muted">Entre com sua conta Google para deixar sua avaliação.</p>}

        {user && !editingReviewId && (
          <button className="btn btn-primary" onClick={() => setReviewSheetOpen(true)} style={{ marginBottom: 20 }}>
            Enviar avaliação
          </button>
        )}

        {reviewSheetOpen && (
          <BottomSheet
            title={editingReviewId ? "Editar avaliação" : "Enviar avaliação"}
            subtitle="Toque nas estrelas e no que combina. Não precisa escrever nada."
            onClose={cancelEditReview}
          >
            <form onSubmit={submitReview} style={{ display: "grid", gap: 16 }}>
              <div>
                <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.85rem" }}>
                  Que nota você dá?
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

              {rating <= 2 && (
                <div className="review-care">
                  <strong>Antes de enviar</strong>
                  <p>
                    Do outro lado tem um vizinho seu, não uma empresa grande. Se ainda dá para resolver, chamar
                    no WhatsApp costuma funcionar melhor que uma nota baixa.
                  </p>
                  <p>
                    Se preferir avaliar mesmo assim, tudo bem — só marque <strong>o que</strong> deu errado. Uma
                    crítica específica ajuda ele a melhorar e ajuda quem vier depois; uma nota baixa sem
                    explicação só machuca.
                  </p>
                </div>
              )}

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
                Quer contar mais alguma coisa? (opcional)
                <textarea
                  placeholder="Como foi o atendimento?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </label>
              {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
              <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
                {saving ? "Enviando…" : editingReviewId ? "Salvar alterações" : "Enviar avaliação"}
              </button>
            </form>
          </BottomSheet>
        )}

        {contactSheetOpen && (
          <BottomSheet
            title={reqSent ? "Pedido enviado" : `Peça para ${comoChamar(professional)} te chamar`}
            subtitle={
              reqSent
                ? undefined
                : "Deixe seu nome e telefone. A pessoa vê o pedido no painel dela e retorna quando puder."
            }
            onClose={() => {
              setContactSheetOpen(false);
              setReqSent(false);
            }}
          >
            {reqSent ? (
              <div style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0 }}>
                  Prontinho — seu recado chegou. Agora é aguardar o retorno; se for urgente, ligar costuma ser
                  mais rápido.
                </p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setContactSheetOpen(false);
                    setReqSent(false);
                  }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={submitContactRequest} style={{ display: "grid", gap: 12 }}>
                <input placeholder="Seu nome" value={reqName} onChange={(e) => setReqName(e.target.value)} />
                <input
                  placeholder="Seu telefone: (31) 99999-9999"
                  inputMode="tel"
                  maxLength={15}
                  value={reqPhone}
                  onChange={(e) => setReqPhone(formatPhone(e.target.value))}
                />
                <textarea
                  placeholder="O que você precisa? (opcional)"
                  rows={3}
                  value={reqMessage}
                  onChange={(e) => setReqMessage(e.target.value)}
                />
                {reqError && <p style={{ color: "var(--color-danger)", margin: 0 }}>{reqError}</p>}
                <button className="btn btn-primary btn-block" type="submit" disabled={reqSaving}>
                  {reqSaving ? "Enviando…" : "Enviar meu contato"}
                </button>
              </form>
            )}
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
              <button className="btn btn-primary" onClick={confirmRemoveReview}>
                Excluir avaliação
              </button>
            </div>
          </BottomSheet>
        )}

        <div className="grid">
          {reviews.length === 0 && <p className="muted">Ainda não tem avaliação por aqui. Se você já chamou essa pessoa, conta pra gente como foi.</p>}
          {reviews.map((r) => {
            const isOwnReview = user?.id === r.user_id;
            const isOwner = user?.id === professional.owner_id;
            return (
              <div key={r.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <Estrelas nota={r.rating} />
                {r.contato_confirmado && (
                  /* Distingue avaliação de quem realmente chamou de opinião
                     solta — é a única distinção que importa para confiar. */
                  <span className="selo-contato" title="Esta pessoa pediu o contato pelo app">
                    ✓ chamou pelo app
                  </span>
                )}
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
              <button className="btn btn-primary btn-block" type="submit" disabled={reportSaving}>
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
