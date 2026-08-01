/**
 * Pagamento por Pix.
 *
 * O Pix tem duas metades: o **QR Code**, que a pessoa aponta a câmera, e o
 * **copia e cola**, que ela cola no aplicativo do banco. As duas carregam a
 * mesma coisa — um texto no padrão BR Code do Banco Central, que diz quem
 * recebe, quanto, e o identificador da cobrança.
 *
 * Esse texto **tem** de vir do servidor, e a razão não é técnica: quem
 * aparece nele é quem recebe o dinheiro. Gerado no navegador, ele apontaria
 * para uma chave que o próprio navegador escolheu — o dinheiro da reserva iria
 * para onde quer que essa chave apontasse, e não haveria como o Avena saber
 * que a cobrança foi paga. Por isso o Mercado Pago gera a cobrança com o token
 * da agência, e é ele quem avisa, pelo webhook, quando o pagamento cai.
 *
 * Enquanto o servidor não existe, este módulo devolve `null` e a tela mostra
 * um aviso no lugar do código. **Nenhum QR falso é desenhado**: um código que
 * parece real e não é dá em uma de duas coisas — dinheiro enviado para o lugar
 * errado, ou uma reserva paga que ninguém recebeu.
 */
import { CHECKOUT_ENDPOINT, PAYMENTS_ENABLED } from "./mercadopago";
import type { Booking } from "../../types";

export interface PixCharge {
  /** Imagem do QR Code, em base64, como o Mercado Pago devolve. */
  qrCodeBase64: string;
  /** O BR Code em texto, para colar no aplicativo do banco. */
  copyPaste: string;
  /** Quando a cobrança perde a validade. */
  expiresAt: string;
  /** Identificador da cobrança no provedor, para conferir depois. */
  chargeId: string;
}

/**
 * Pede ao servidor uma cobrança Pix para esta reserva.
 *
 * Devolve `null` quando não há servidor configurado — a tela trata isso como
 * "ainda não dá para pagar", que é a verdade.
 */
export async function createPixCharge(booking: Booking): Promise<PixCharge | null> {
  if (!PAYMENTS_ENABLED) return null;

  const response = await fetch(`${CHECKOUT_ENDPOINT}/pix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: booking.id }),
  });
  if (!response.ok) throw new Error("pix-indisponivel");
  return (await response.json()) as PixCharge;
}

/**
 * Se a cobrança já foi paga.
 *
 * Perguntado ao servidor, nunca decidido aqui. O caminho de verdade é o
 * webhook do Mercado Pago avisando o servidor; esta consulta existe porque a
 * pessoa está olhando a tela e quer ver a confirmação sem recarregar.
 */
export async function pixWasPaid(chargeId: string): Promise<boolean> {
  if (!PAYMENTS_ENABLED) return false;
  const response = await fetch(
    `${CHECKOUT_ENDPOINT}/pix/${encodeURIComponent(chargeId)}`
  );
  if (!response.ok) return false;
  const data = (await response.json()) as { paid?: boolean };
  return data.paid === true;
}

/** Minutos até a cobrança expirar, para a contagem na tela. */
export function minutesUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
}
