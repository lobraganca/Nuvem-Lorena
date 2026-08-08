import { supabase } from "./supabase";
import type { SubscriptionType } from "../types/domain";

/**
 * Ponto único de entrada para iniciar uma assinatura recorrente no Mercado
 * Pago (selo de verificação, R$10,90/mês) ou o "turbinar anúncio" (destaque
 * pago, também modelado como assinatura recorrente para simplificar renovação
 * automática — pode virar cobrança avulsa no futuro sem mudar esta função).
 *
 * O token de acesso do Mercado Pago (MP_ACCESS_TOKEN) NUNCA fica no
 * navegador: esta função apenas invoca a Edge Function
 * `mercadopago-create-subscription`, que roda no servidor e é a única peça
 * que conhece o token. Configure o token como secret da função:
 *
 *   supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
 *
 * (Veja o README deste app para o passo a passo completo.)
 */
export async function startSubscriptionCheckout(
  professionalId: string,
  type: SubscriptionType
): Promise<{ initPoint: string }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const functionName = type === "plus" ? "mercadopago-create-plus-subscription" : "mercadopago-create-subscription";
  const { data, error } = await client.functions.invoke(functionName, {
    body: { professionalId, type },
  });

  if (error) throw error;
  if (!data?.initPoint) throw new Error("Resposta inesperada do checkout do Mercado Pago.");
  return { initPoint: data.initPoint as string };
}

/**
 * Compra avulsa (Checkout Pro, não recorrente) de um pacote de créditos de
 * contato para o modo "pagar por contato".
 */
export async function startCreditsCheckout(professionalId: string, quantity: number): Promise<{ initPoint: string }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.functions.invoke("mercadopago-buy-credits", {
    body: { professionalId, quantity },
  });
  if (error) throw error;
  if (!data?.initPoint) throw new Error("Resposta inesperada do checkout do Mercado Pago.");
  return { initPoint: data.initPoint as string };
}

/** Compra avulsa (Checkout Pro) do banner de categoria patrocinada, por N dias. */
export async function startSponsorshipCheckout(
  professionalId: string,
  category: string,
  city: string,
  days: number
): Promise<{ initPoint: string }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.functions.invoke("mercadopago-sponsor-category", {
    body: { professionalId, category, city, days },
  });
  if (error) throw error;
  if (!data?.initPoint) throw new Error("Resposta inesperada do checkout do Mercado Pago.");
  return { initPoint: data.initPoint as string };
}

/** Preços atuais do produto — únicos, para não divergir entre telas. */
export const PRICES = {
  verification: { label: "Selo de verificação", amount: 10.9, period: "mensal" as const },
  boost: { label: "Turbinar anúncio", amount: 19.9, period: "mensal" as const },
  plus: { label: "Empresa Plus", amount: 29.9, period: "mensal" as const },
  leadCreditCents: 290, // R$2,90 por lead (crédito de contato avulso)
};
