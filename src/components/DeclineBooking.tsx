import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { formatBRL } from "../lib/money";
import type { Booking } from "../types";

/**
 * A empresa diz que não vai conseguir atender.
 *
 * Faltava, e a falta era pior do que parece: o barco quebrou, o guia
 * adoeceu, e não havia botão nenhum — restava à agência ligar por fora e
 * combinar a devolução na mão, fora do registro, com a reserva do app dizendo
 * "confirmada" até o dia.
 *
 * O reembolso é integral e a política de cancelamento não é consultada. Ela
 * existe para quando quem desiste é o viajante; cobrar multa de alguém por um
 * "não" que não foi dele é indefensável, e é o tipo de coisa que uma
 * plataforma faz uma vez e paga por anos.
 *
 * O motivo é obrigatório e fica gravado. Sem ele não há como distinguir o
 * imprevisto honesto da agência que aceita tudo e escolhe depois.
 */
export function DeclineBooking({ booking }: { booking: Booking }) {
  const { declineBooking } = useAvena();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        Não vou conseguir atender
      </button>
    );
  }

  return (
    <div className="booking-form">
      <p>
        A reserva é cancelada e o viajante recebe{" "}
        <strong>R$ {formatBRL(booking.totalPrice)} de volta</strong> — tudo o que
        pagou, inclusive a taxa de serviço.
      </p>
      <label>
        O que aconteceu
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ex.: o barco quebrou e não há outro para esta data"
        />
      </label>
      <p className="muted">
        O viajante vê este texto. Recusas ficam registradas e contam para a sua
        reputação — é o que separa o imprevisto de quem aceita tudo e escolhe
        depois.
      </p>
      <div className="chip-row">
        <button
          type="button"
          className="btn-primary"
          disabled={!reason.trim()}
          onClick={() => declineBooking(booking.id, reason.trim())}
        >
          Confirmar recusa
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Voltar
        </button>
      </div>
    </div>
  );
}
