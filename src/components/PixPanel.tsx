import { useEffect, useState } from "react";
import {
  createPixCharge,
  minutesUntil,
  pixWasPaid,
  type PixCharge,
} from "../lib/payments/pix";
import { PAYMENTS_ENABLED } from "../lib/payments/mercadopago";
import { formatBRL } from "../lib/money";
import type { Booking } from "../types";

/**
 * A tela do Pix: o QR, o copia e cola, e a espera.
 *
 * A espera é parte da tela e não um detalhe. Depois de pagar, a pessoa volta
 * para cá e olha — se nada mudar, ela paga de novo. Por isso a confirmação é
 * consultada sozinha, e o texto diz que não é preciso fazer mais nada.
 */
export function PixPanel({
  booking,
  onPaid,
}: {
  booking: Booking;
  onPaid: () => void;
}) {
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    createPixCharge(booking)
      .then((c) => {
        if (alive) setCharge(c);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [booking]);

  // Enquanto a cobrança está aberta, pergunta ao servidor de tempos em tempos.
  // Cinco segundos: o Pix cai em segundos, e uma tela parada faz a pessoa
  // pagar duas vezes.
  useEffect(() => {
    if (!charge) return;
    const timer = window.setInterval(() => {
      pixWasPaid(charge.chargeId).then((paid) => {
        if (paid) onPaid();
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [charge, onPaid]);

  async function copy() {
    if (!charge) return;
    try {
      await navigator.clipboard.writeText(charge.copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão para a área de transferência: o texto continua na tela
      // para copiar à mão, que é o motivo de ele estar visível.
    }
  }

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="pix-panel">
        <div className="pix-placeholder">
          <span>QR Code do Pix</span>
          <small>aparece aqui quando o servidor estiver no ar</small>
        </div>
        {/* Nenhum código falso é desenhado. Um QR que parece real e não é
            termina de duas maneiras: dinheiro no lugar errado, ou uma reserva
            paga que ninguém recebeu. */}
        <p className="muted">
          O código do Pix diz quem recebe o dinheiro, e por isso só pode ser
          gerado pelo servidor, com a conta da empresa. Nesta versão de teste
          ele não existe — nada é cobrado.
        </p>
      </div>
    );
  }

  if (loading) return <p className="muted">Gerando o código do Pix…</p>;

  if (failed || !charge) {
    return (
      <p className="availability-note availability-none">
        Não foi possível gerar o Pix agora. Tente de novo, ou pague com cartão.
      </p>
    );
  }

  const minutes = minutesUntil(charge.expiresAt);

  return (
    <div className="pix-panel">
      <img
        className="pix-qr"
        src={`data:image/png;base64,${charge.qrCodeBase64}`}
        alt="QR Code para pagar com Pix"
      />

      <p className="pix-amount">R$ {formatBRL(booking.totalPrice)}</p>

      <label className="pix-code-label">
        Pix copia e cola
        <textarea className="pix-code" readOnly value={charge.copyPaste} rows={3} />
      </label>

      <button type="button" className="btn-primary" onClick={copy}>
        {copied ? "Código copiado" : "Copiar código"}
      </button>

      <p className="muted">
        Abra o aplicativo do seu banco, escolha Pix e aponte a câmera para o
        código — ou cole o texto acima. O código vale por {minutes}{" "}
        {minutes === 1 ? "minuto" : "minutos"}.
      </p>

      <p className="availability-note">
        Assim que o pagamento cair, esta tela confirma sozinha. Não é preciso
        fazer mais nada, e não pague duas vezes.
      </p>
    </div>
  );
}
