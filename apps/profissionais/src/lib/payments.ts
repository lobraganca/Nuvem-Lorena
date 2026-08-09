import { supabase } from "./supabase";
import type { BillingCycle, SubscriptionType } from "../types/domain";

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
 * Plano ANUAL RECORRENTE no cartão — `preapproval` com frequência de 12
 * meses: o Mercado Pago cobra o cartão sozinho todo ano, com 20% de desconto
 * sobre 12x o mensal. É o caminho anual que renova de verdade, sem ação do
 * dono do anúncio (Edge Function `mercadopago-create-annual-subscription`).
 */
export async function startAnnualSubscriptionCheckout(
  professionalId: string,
  type: SubscriptionType
): Promise<{ initPoint: string }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.functions.invoke("mercadopago-create-annual-subscription", {
    body: { professionalId, type },
  });
  if (error) throw error;
  if (!data?.initPoint) throw new Error("Resposta inesperada do checkout do Mercado Pago.");
  return { initPoint: data.initPoint as string };
}

/**
 * Plano anual à vista (Checkout Pro, pagamento único) das 3 assinaturas —
 * mesmo preço do anual recorrente (20% de desconto sobre 12x o mensal), mas
 * aceitando Pix/cartão/boleto, que não têm débito automático na API do
 * Mercado Pago. Por isso NÃO renova sozinho: perto do vencimento, a Edge
 * Function agendada `renew-annual-plans` gera a nova cobrança e manda o link
 * por e-mail ao dono do anúncio.
 */
export async function startAnnualCheckout(
  professionalId: string,
  type: SubscriptionType
): Promise<{ initPoint: string }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.functions.invoke("mercadopago-create-annual-payment", {
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

/**
 * Preço do plano anual à vista (20% de desconto sobre 12x o mensal) das 3
 * assinaturas — mesmo cálculo feito no servidor (mercadopago-create-annual-
 * payment), replicado aqui só para exibir o valor na tela antes do checkout.
 */
export function annualPrice(type: SubscriptionType): number {
  return Number((PRICES[type].amount * 12 * 0.8).toFixed(2));
}


/**
 * Assinaturas ativas de um anúncio, para a tela de cancelamento.
 *
 * A leitura passa pelo RLS: uma pessoa só enxerga as assinaturas dos próprios
 * anúncios. A tela usa isso para oferecer o cancelamento; quem decide se pode
 * cancelar é o servidor, de novo, na Edge Function.
 */
export interface AssinaturaAtiva {
  id: string;
  type: SubscriptionType;
  billing_cycle: BillingCycle;
  status: string;
  created_at: string;
  current_period_end: string | null;
}

export async function getAssinaturasAtivas(professionalId: string): Promise<AssinaturaAtiva[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("subscriptions")
    .select("id, type, billing_cycle, status, created_at, current_period_end")
    .eq("professional_id", professionalId)
    .in("status", ["active", "authorized", "pending"])
    .order("created_at", { ascending: false });
  return (data ?? []) as AssinaturaAtiva[];
}

/**
 * Cancela a assinatura. O reembolso dos 7 dias é decidido no servidor, a
 * partir da data real da cobrança — nunca a partir do que a tela calculou.
 */
export async function cancelarAssinatura(
  subscriptionId: string
): Promise<{ reembolsado: boolean; dentroDoArrependimento: boolean }> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { data, error } = await client.functions.invoke("cancel-subscription", {
    body: { subscriptionId },
  });
  if (error) throw new Error("Não foi possível cancelar agora. Tente de novo em alguns minutos.");
  const resposta = data as { error?: string; reembolsado?: boolean; dentroDoArrependimento?: boolean };
  if (resposta?.error) throw new Error(resposta.error);
  return {
    reembolsado: !!resposta?.reembolsado,
    dentroDoArrependimento: !!resposta?.dentroDoArrependimento,
  };
}
