import type { Booking, Business } from "../../types";

/**
 * Mercado Pago split payments (the "marketplace" model).
 *
 * The money never passes through an Avena account: the traveller pays the
 * agency directly, and Mercado Pago retains Avena's commission at the moment of
 * the transaction. That matters legally as much as financially — holding other
 * people's money would make Avena a payment institution, with everything the
 * Banco Central requires of one.
 *
 * Nothing in this file talks to Mercado Pago. Creating a payment needs the
 * seller's access token, and a token in the browser is a token in the hands of
 * anyone who opens the developer tools. This module only builds the request
 * that the backend will send, so the shape lives next to the domain rules that
 * produce it.
 */

/** Enabled only when a backend is configured to talk to Mercado Pago. */
export const PAYMENTS_ENABLED =
  import.meta.env.VITE_PAYMENTS_ENABLED === "true";

/** Where the backend exposes the checkout endpoint. */
export const CHECKOUT_ENDPOINT =
  import.meta.env.VITE_CHECKOUT_ENDPOINT ?? "/api/checkout";

export interface PreferenceItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  currency_id: "BRL";
}

/**
 * The payload the backend posts to Mercado Pago, using the *agency's* access
 * token — obtained when the agency connected its account through OAuth.
 */
export interface CheckoutPreference {
  items: PreferenceItem[];
  /**
   * Avena's cut, in reais, retained by Mercado Pago and sent to the marketplace
   * account. This is the commission the booking already computed, so the number
   * the traveller saw and the number actually charged cannot drift apart.
   */
  marketplace_fee: number;
  external_reference: string;
  payer: { name: string };
  back_urls: { success: string; pending: string; failure: string };
  auto_return: "approved";
  /** Where Mercado Pago notifies the backend of status changes. */
  notification_url?: string;
  /** Mirrors the hold the app already applies to the seat. */
  expires: true;
  expiration_date_to?: string;
}

export function buildPreference(
  booking: Booking,
  origin: string,
  notificationUrl?: string
): CheckoutPreference {
  return {
    items: [
      {
        id: booking.tourId,
        title: booking.tourTitle,
        description: `${booking.businessName} · ${booking.travelDate}`,
        quantity: booking.travelers,
        unit_price: booking.unitPrice,
        currency_id: "BRL",
      },
    ],
    marketplace_fee: booking.serviceFee,
    // Lets the webhook find the booking again without trusting anything the
    // browser sends back.
    external_reference: booking.id,
    payer: { name: booking.participants[0]?.name ?? "" },
    back_urls: {
      success: `${origin}/pagamento/${booking.id}?status=sucesso`,
      pending: `${origin}/pagamento/${booking.id}?status=pendente`,
      failure: `${origin}/pagamento/${booking.id}?status=falha`,
    },
    auto_return: "approved",
    notification_url: notificationUrl,
    expires: true,
    expiration_date_to: booking.paymentDueAt,
  };
}

/** Mercado Pago payment states, mapped to what a booking means in this app. */
export type MercadoPagoStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export function bookingStatusFromPayment(
  status: MercadoPagoStatus
): "confirmada" | "aguardando-pagamento" | "cancelada" {
  switch (status) {
    case "approved":
      return "confirmada";
    case "pending":
    case "in_process":
      // Boleto and some Pix payments clear later; the seat stays held.
      return "aguardando-pagamento";
    default:
      return "cancelada";
  }
}

/** True when the agency can actually receive a split payment. */
export function canReceivePayments(business: Business): boolean {
  return business.mercadoPago?.connected === true;
}

export interface CheckoutSession {
  /** Mercado Pago's hosted checkout URL the traveller is redirected to. */
  initPoint: string;
  preferenceId: string;
}

/**
 * Asks the backend to create the checkout. Kept as the single seam so the day
 * the backend exists, only this function changes.
 */
export async function createCheckout(booking: Booking): Promise<CheckoutSession> {
  const response = await fetch(CHECKOUT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: booking.id }),
  });

  if (!response.ok) {
    throw new Error(`checkout-failed-${response.status}`);
  }
  return (await response.json()) as CheckoutSession;
}
