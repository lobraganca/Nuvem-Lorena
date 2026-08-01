import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { ModerationNotice, isPublishable } from "./ModerationNotice";
import type { Review } from "../types";

/**
 * As avaliações que a empresa recebeu, e a resposta a elas.
 *
 * O dono não via as próprias notas: elas apareciam para o viajante e não no
 * painel. Responder a uma crítica é a principal ferramenta de reputação que
 * alguém tem aqui — uma nota 2 respondida com educação convence mais que dez
 * notas 5 sem palavra nenhuma.
 *
 * A resposta é pública e definitiva, como a avaliação. Sem apagar, sem editar
 * depois: um histórico que muda não serve de histórico.
 */
function ReplyBox({ review }: { review: Review }) {
  const { replyToReview } = useAvena();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (review.reply) {
    return (
      <div className="review-reply">
        <strong>Sua resposta</strong>
        <p>{review.reply}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Responder
      </button>
    );
  }

  return (
    <div className="review-reply-form">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Responda a quem viajou com você. Isto fica público."
      />
      <ModerationNotice text={text} />
      <div className="chip-row">
        <button
          type="button"
          className="btn-primary"
          disabled={!text.trim() || !isPublishable(text)}
          onClick={() => replyToReview(review.id, text.trim())}
        >
          Publicar resposta
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      <p className="muted">
        A resposta não pode ser editada nem apagada depois — como a avaliação.
      </p>
    </div>
  );
}

export function BusinessReviews({ businessId }: { businessId: string }) {
  const { reviews } = useAvena();
  const minhas = reviews
    .filter((r) => r.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <h2 className="timeline-title">Avaliações recebidas</h2>
      {minhas.length === 0 ? (
        <p className="muted">
          Nenhuma avaliação ainda. Elas aparecem depois que alguém faz o passeio
          — só avalia quem foi.
        </p>
      ) : (
        <div className="timeline">
          {minhas.map((r) => (
            <div key={r.id} className="booking-card">
              <div className="timeline-card-title">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
                <span className="muted"> · {r.tourTitle}</span>
              </div>
              <div className="muted">
                {r.authorName} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
              </div>
              {r.comment && <p>{r.comment}</p>}
              <ReplyBox review={r} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
