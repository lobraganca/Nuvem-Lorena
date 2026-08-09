import { supabase } from "./supabase";
import { erroDaFunction } from "./erros";
import type { BillingCycle, EntityType, SubscriptionType } from "../types/domain";

/**
 * Ponto único de entrada para iniciar uma assinatura recorrente no Mercado
 * Pago (conta premium, R$10,90/mês) ou o "turbinar anúncio" (destaque
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

  if (error) throw await erroDaFunction(error);
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
  if (error) throw await erroDaFunction(error);
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
  if (error) throw await erroDaFunction(error);
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
  if (error) throw await erroDaFunction(error);
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
  if (error) throw await erroDaFunction(error);
  if (!data?.initPoint) throw new Error("Resposta inesperada do checkout do Mercado Pago.");
  return { initPoint: data.initPoint as string };
}

/** Preços atuais do produto — únicos, para não divergir entre telas. */
/**
 * O que o app cobra.
 *
 * Quatro fontes, três delas aqui: conta premium, turbinar o anúncio e
 * Empresa Plus (relatórios, só para empresa). A quarta é a tela de Anúncios,
 * que não aparece nesta lista porque não é autoatendimento — o banner é
 * vendido na conversa e o valor combinado fica anotado no painel de banners
 * (ver migration 0040).
 *
 * Saiu só o crédito por contato: cobrar por contato recebido faz o
 * anunciante torcer contra o próprio anúncio nos dias de aperto, que é o
 * oposto do que este app precisa. A coluna continua no banco, para não
 * perder histórico.
 */
export const PRICES = {
  verification: { label: "Conta premium", amount: 10.9, period: "mensal" as const },
  boost: { label: "Turbinar anúncio", amount: 19.9, period: "mensal" as const },
  plus: { label: "Empresa Plus", amount: 29.9, period: "mensal" as const },
  leadCreditCents: 290,
};

/**
 * Preço mensal por tipo de cadastro.
 *
 * A conta premium custa R$ 10,90 para pessoa física e R$ 19,90 para empresa.
 * Não é cobrar mais de quem pode pagar mais: é cobrar proporcional ao que
 * cada um leva — a empresa aparece com logo, responsável, endereço e lista
 * de serviços, e usa o app como canal de venda; o autônomo usa como agenda.
 *
 * Esta tabela é só para MOSTRAR o valor antes do checkout. Quem cobra é o
 * servidor, que lê o `entity_type` do banco (ver
 * supabase/functions/_shared/precos.ts) — se o preço saísse daqui, bastaria
 * mexer no navegador para uma empresa assinar pelo preço de pessoa física.
 */
export const PRECOS_MENSAIS: Record<SubscriptionType, { pf: number; pj: number }> = {
  verification: { pf: 10.9, pj: 19.9 },
  boost: { pf: 19.9, pj: 19.9 },
  plus: { pf: 29.9, pj: 29.9 },
};

export function precoMensal(tipo: SubscriptionType, entityType: EntityType): number {
  return PRECOS_MENSAIS[tipo][entityType === "pj" ? "pj" : "pf"];
}

/**
 * Preço do plano anual à vista (20% de desconto sobre 12x o mensal) das 3
 * assinaturas — mesmo cálculo feito no servidor (mercadopago-create-annual-
 * payment), replicado aqui só para exibir o valor na tela antes do checkout.
 */
export function annualPrice(type: SubscriptionType, entityType: EntityType = "pf"): number {
  return Number((precoMensal(type, entityType) * 12 * 0.8).toFixed(2));
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

  /* A linha "pending" nasce quando o link de pagamento é gerado, antes de
     qualquer dinheiro entrar. Quem abre o checkout e desiste — ou nem tem
     conta no Mercado Pago — deixa uma pendente para sempre. Tratá-la como
     assinatura fazia o app dizer que a pessoa assinou sem ter pago, e ainda
     escondia a oferta, impedindo a próxima tentativa.

     Pendente recente ainda vale a pena mostrar: é alguém que acabou de sair
     para pagar e pode voltar em instantes. Passado esse tempo, é abandono. */
  return ((data ?? []) as AssinaturaAtiva[]).filter(
    (a) => assinaturaConfirmada(a) || pendenteRecente(a)
  );
}

/** Uma hora é folga suficiente para pagar por Pix ou boleto e voltar. */
export const PENDENTE_EXPIRA_MS = 60 * 60 * 1000;

/** Paga e valendo — o único estado que dá direito ao benefício. */
export function assinaturaConfirmada(a: AssinaturaAtiva): boolean {
  return a.status === "active" || a.status === "authorized";
}

/** Saiu para pagar agora há pouco; ainda pode voltar. */
export function pendenteRecente(a: AssinaturaAtiva): boolean {
  if (a.status !== "pending") return false;
  const criada = new Date(a.created_at).getTime();
  return Number.isFinite(criada) && Date.now() - criada < PENDENTE_EXPIRA_MS;
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


/**
 * Vagas de destaque restantes numa categoria/cidade (teto de 5).
 *
 * Quem conta é o banco: a tela não tem como enxergar todos os anúncios, e
 * mesmo que tivesse, contar no navegador seria confiar num número que a
 * própria pessoa pode alterar.
 */
export async function vagasDeDestaque(category: string, city: string): Promise<number> {
  const client = supabase();
  if (!client) return 0;
  const { data, error } = await client.rpc("vagas_de_destaque", {
    p_category: category,
    p_city: city,
  });
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

/** Entra na fila de espera do destaque daquela categoria/cidade. */
export async function entrarNaFilaDeDestaque(
  professionalId: string,
  category: string,
  city: string
): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client
    .from("destaque_espera")
    .upsert(
      { professional_id: professionalId, category, city },
      { onConflict: "professional_id,category,city" }
    );
  if (error) throw await erroDaFunction(error);
}
