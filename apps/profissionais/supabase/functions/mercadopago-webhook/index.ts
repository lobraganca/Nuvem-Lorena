// Edge Function: webhook do Mercado Pago — confirma TODOS os fluxos de
// pagamento do app (as 3 assinaturas recorrentes mensais via preapproval,
// as mesmas 3 no plano anual à vista, créditos de contato e patrocínio de
// categoria, ambos via checkout/preferences).
//
// 1. Cadastre esta URL como webhook no painel do Mercado Pago:
//      https://<projeto>.functions.supabase.co/mercadopago-webhook
// 2. O Mercado Pago manda DOIS formatos de notificação diferentes, que
//    precisam ser tratados separadamente:
//      - `type: "subscription_preapproval"` (ou `topic: "preapproval"`,
//        dependendo de como o webhook foi configurado no painel) — usado
//        pelas 3 assinaturas recorrentes mensais (verification/boost/plus).
//        Consulta-se `GET /preapproval/{id}`.
//      - `type: "payment"` — usado por TODOS os pagamentos avulsos via
//        Checkout Pro: créditos de contato, patrocínio de categoria e os
//        planos anuais à vista das 3 assinaturas. Consulta-se
//        `GET /v1/payments/{id}`.
//    Qualquer outro `type`/`topic` é ignorado (responde 200 vazio).
// 3. O corpo do webhook NUNCA é confiado cegamente (pode ser forjado) — o
//    status real é sempre revalidado consultando a API do Mercado Pago com
//    o MP_ACCESS_TOKEN.
// 4. Sempre responde 200 rapidamente, mesmo em erro interno, para evitar
//    reenvio agressivo do Mercado Pago — mas loga o erro com console.error
//    para depuração em produção.
//
// --- Tratamento por external_reference -------------------------------
//
// `subscription_preapproval` com status "authorized" — external_reference
// em UM DOS DOIS formatos (type = verification|boost|plus):
//   - "<professionalId>:<type>"         → assinatura MENSAL (preapproval de
//     1 mês) — "..._until" = agora + 1 mês.
//   - "<professionalId>:<type>:annual"  → assinatura ANUAL RECORRENTE
//     (preapproval de 12 meses, criada por
//     `mercadopago-create-annual-subscription`) — "..._until" = agora + 1
//     ano. Se o sufixo faltar (preapproval antiga), cai no `billing_cycle`
//     já gravado na linha de `subscriptions`; sem os dois, assume mensal.
//   - subscriptions: status='active', current_period_end = mesma data,
//     localizada por mercadopago_subscription_id.
//   - professionals: marca o campo correspondente
//     (verified/verified_until, boosted/boosted_until, plus_active/
//     plus_until).
// status "cancelled"/"paused": só reflete em subscriptions.status — o
// verified/boosted/plus_active cai sozinho quando "..._until" expira (ver
// isCurrentlyVerified/isCurrentlyBoosted/isCurrentlyPlusActive no client).
//
// `payment` com status "approved" — três prefixos possíveis de
// external_reference:
//   - "credits:<professionalId>:<quantity>": upsert em lead_credits
//     somando quantity ao saldo.
//   - "sponsor:<sponsorshipId>": category_sponsorships vira status='active',
//     grava mercadopago_payment_id.
//   - "annual:<professionalId>:<type>": plano anual à vista (pagamento
//     único, 20% off, Pix/cartão/boleto) — mesmo efeito da preapproval
//     authorized, mas "..._until" = agora + 1 ano. A linha em subscriptions
//     (mais recente pending do profissional+type+billing_cycle='annual')
//     vira status='active'; se não houver pending, é o pagamento de uma
//     RENOVAÇÃO avisada por `renew-annual-plans` (que não cria linha nova),
//     e a linha 'active' existente é estendida. Em qualquer caso,
//     `renewal_notified_at` volta a null, liberando o aviso do ciclo
//     seguinte.
//   - "<professionalId>:<type>" / "<professionalId>:<type>:annual" (sem
//     prefixo conhecido): é a COBRANÇA RECORRENTE de uma preapproval — o
//     Mercado Pago manda um `payment` a cada renovação, com o mesmo
//     external_reference da assinatura. Empurra "..._until" +1 mês (mensal)
//     ou +1 ano (anual); sem isso a assinatura seria cobrada de novo mas o
//     benefício expiraria no fim do primeiro período.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { UNTIL_FIELD } from "../_shared/beneficios.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
/**
 * Segredo da assinatura do webhook (Mercado Pago > Suas integrações >
 * Webhooks > "Chave secreta"). Sem ele configurado, a checagem é ignorada e
 * o comportamento é o de antes — a revalidação na API do Mercado Pago segue
 * sendo a defesa principal. Com ele, notificação forjada nem chega a virar
 * consulta.
 */
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

/**
 * Confere a assinatura que o Mercado Pago manda no cabeçalho `x-signature`.
 *
 * O formato é `ts=<timestamp>,v1=<hash>`, e o hash é um HMAC-SHA256 sobre o
 * texto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — exatamente nessa
 * ordem, com os dois-pontos e ponto-e-vírgula, senão não fecha.
 *
 * A comparação é feita byte a byte em tempo constante: comparar com `===`
 * vaza, pelo tempo de resposta, quantos caracteres iniciais estavam certos.
 */
async function assinaturaValida(req: Request, dataId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return true;

  const assinatura = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = new Map(
    assinatura.split(",").map((p) => {
      const [k, ...resto] = p.trim().split("=");
      return [k, resto.join("=")] as const;
    })
  );
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;

  // Assinatura velha é ataque de repetição: o mesmo aviso reenviado depois
  // para reprocessar um pagamento antigo.
  const idadeSegundos = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(idadeSegundos) || idadeSegundos > 600) return false;

  const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto));
  const esperado = Array.from(new Uint8Array(assinado))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (esperado.length !== v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diferenca === 0;
}

type Admin = ReturnType<typeof createClient>;

const SUBSCRIPTION_TYPES = ["verification", "boost", "plus"] as const;
type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

function isSubscriptionType(value: string): value is SubscriptionType {
  return (SUBSCRIPTION_TYPES as readonly string[]).includes(value);
}

function professionalFieldsFor(type: SubscriptionType, until: string) {
  if (type === "verification") return { verified: true, verified_until: until };
  if (type === "boost") return { boosted: true, boosted_until: until };
  return { plus_active: true, plus_until: until };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/**
 * Calcula a nova validade do benefício SOMANDO ao tempo que ainda resta, e
 * não a partir de agora. Importa na renovação: a cobrança do plano anual à
 * vista é gerada 7 dias antes de vencer, então quem paga assim que recebe o
 * e-mail perderia esses dias se a conta partisse de `now()`. Se o benefício
 * já venceu (ou nunca existiu), conta a partir de agora.
 */
async function nextUntil(
  admin: Admin,
  professionalId: string,
  type: SubscriptionType,
  isAnnual: boolean
): Promise<string> {
  const field = UNTIL_FIELD[type];
  const { data } = await admin.from("professionals").select(field).eq("id", professionalId).maybeSingle();
  const currentRaw = (data as any)?.[field];
  const current = currentRaw ? new Date(currentRaw) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  return (isAnnual ? addYears(base, 1) : addMonths(base, 1)).toISOString();
}

async function handlePreapproval(admin: Admin, preapprovalId: string) {
  const resp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!resp.ok) {
    console.error("mercadopago-webhook: falha ao consultar preapproval", preapprovalId, resp.status);
    return;
  }
  const preapproval = await resp.json();
  // Aceita os DOIS formatos de external_reference de preapproval:
  //   "<professionalId>:<type>"          → mensal (formato original)
  //   "<professionalId>:<type>:annual"   → anual recorrente (preapproval de
  //                                        12 meses)
  const [professionalId, type, cycleSuffix] = String(preapproval.external_reference ?? "").split(":");
  if (!professionalId || !type || !isSubscriptionType(type)) {
    console.error("mercadopago-webhook: external_reference inválido em preapproval", preapproval.external_reference);
    return;
  }

  if (preapproval.status === "authorized") {
    // O sufixo do external_reference é a fonte primária; se ele vier vazio
    // (preapproval antiga, criada antes do plano anual), cai no
    // `billing_cycle` já gravado em subscriptions. Sem os dois, assume
    // mensal — o comportamento que sempre existiu.
    let isAnnual = cycleSuffix === "annual";
    if (!isAnnual) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("billing_cycle")
        .eq("mercadopago_subscription_id", preapprovalId)
        .maybeSingle();
      isAnnual = existing?.billing_cycle === "annual";
    }

    const until = await nextUntil(admin, professionalId, type, isAnnual);
    await admin
      .from("subscriptions")
      .update({
        status: "active",
        current_period_end: until,
        billing_cycle: isAnnual ? "annual" : "monthly",
        auto_renew: true,
        // Preapproval renova sozinha: nunca há aviso de renovação pendente.
        renewal_notified_at: null,
      })
      .eq("mercadopago_subscription_id", preapprovalId);
    await admin
      .from("professionals")
      .update(professionalFieldsFor(type, until))
      .eq("id", professionalId);
  } else if (preapproval.status === "cancelled" || preapproval.status === "paused") {
    await admin
      .from("subscriptions")
      .update({ status: preapproval.status })
      .eq("mercadopago_subscription_id", preapprovalId);
  }
}

/**
 * Classifica o pagamento pelo `external_reference` que nós mesmos montamos
 * na criação da cobrança — é o único lugar onde essa informação existe do
 * nosso lado.
 *
 * Devolve null quando não reconhece, em vez de chutar um tipo: no painel,
 * um pagamento sem categoria aparece somado ao total e de fora do detalhe,
 * o que é honesto. Chutando, ele entraria na linha errada e ninguém
 * desconfiaria.
 */
function tipoDoPagamento(ref: string): string | null {
  if (ref.startsWith("credits:")) return "credits";
  if (ref.startsWith("sponsor:")) return "sponsorship";
  // "annual:<tipo>:<id>" e "mensal:<tipo>:<id>"
  if (ref.startsWith("annual:") || ref.startsWith("mensal:")) {
    const tipo = ref.split(":")[1];
    return tipo === "verification" || tipo === "boost" || tipo === "plus" ? tipo : null;
  }
  return null;
}

async function handlePayment(admin: Admin, paymentId: string) {
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!resp.ok) {
    console.error("mercadopago-webhook: falha ao consultar payment", paymentId, resp.status);
    return;
  }
  const payment = await resp.json();
  if (payment.status !== "approved") return;

  // IDEMPOTÊNCIA: o Mercado Pago manda mais de uma notificação para o mesmo
  // pagamento (payment.created, payment.updated e reenvios). Sem esta trava,
  // a compra de créditos — que SOMA ao saldo — daria crédito em dobro.
  // Reserva o id antes de aplicar qualquer efeito; se já estiver reservado,
  // este evento é repetido e não deve fazer nada.
  /* O valor entra no MESMO insert da trava de idempotência — não é uma
     consulta a mais nem um caminho novo que possa falhar sozinho: o
     `transaction_amount` já veio na resposta que acabamos de ler para saber
     se o pagamento foi aprovado.
     Em centavos e arredondado porque o Mercado Pago devolve reais como
     número de ponto flutuante, e somar centenas de floats em reais rende
     aquele total com sobra de centavo que ninguém consegue explicar. */
  const valorCentavos = Number.isFinite(payment.transaction_amount)
    ? Math.round(Number(payment.transaction_amount) * 100)
    : null;
  const { error: claimError } = await admin.from("processed_payments").insert({
    payment_id: String(paymentId),
    valor_centavos: valorCentavos,
    tipo: tipoDoPagamento(String(payment.external_reference ?? "")),
  });
  if (claimError?.code === "23505") {
    console.log("mercadopago-webhook: pagamento já processado, ignorando duplicata:", paymentId);
    return;
  }
  if (claimError) {
    // Falha inesperada na trava (ex.: migration 0021 ainda não aplicada).
    // Segue processando mesmo assim: deixar de creditar um pagamento já pago
    // é pior que o risco de duplicata — mas loga alto para ser corrigido.
    console.error("mercadopago-webhook: não foi possível registrar idempotência", paymentId, claimError);
  }

  try {
    await applyPaymentEffect(admin, paymentId, payment);
  } catch (err) {
    // Desfaz a reserva para que o reenvio do Mercado Pago possa tentar de novo.
    await admin.from("processed_payments").delete().eq("payment_id", String(paymentId));
    throw err;
  }
}

/**
 * Amarra o pagamento à assinatura que ele custeou.
 *
 * É isso que permite, no cancelamento, saber qual cobrança devolver quando a
 * pessoa desiste dentro dos 7 dias do direito de arrependimento. Sem o
 * vínculo, o reembolso viraria adivinhação — ou uma consulta a mais ao
 * Mercado Pago bem no momento em que ela quer resolver e ir embora.
 */
async function vinculaPagamentoAAssinatura(admin: Admin, paymentId: string, subscriptionId: string) {
  const { error } = await admin
    .from("processed_payments")
    .update({ subscription_id: subscriptionId })
    .eq("payment_id", String(paymentId));
  if (error) console.error("mercadopago-webhook: não vinculou pagamento à assinatura", paymentId, error);
}

async function applyPaymentEffect(admin: Admin, paymentId: string, payment: any) {
  const ref: string = String(payment.external_reference ?? "");

  if (ref.startsWith("credits:")) {
    const [, professionalId, quantityStr] = ref.split(":");
    const quantity = Number(quantityStr);
    if (!professionalId || !Number.isFinite(quantity) || quantity <= 0) {
      console.error("mercadopago-webhook: external_reference de créditos inválido", ref);
      return;
    }
    // Soma atômica no banco (RPC security definer): o "lê saldo, soma aqui,
    // grava de volta" perderia uma das compras se dois pagamentos fossem
    // confirmados ao mesmo tempo.
    const { error } = await admin.rpc("add_lead_credits", {
      p_professional_id: professionalId,
      p_amount: quantity,
    });
    if (error) throw error;
    return;
  }

  if (ref.startsWith("sponsor:")) {
    const [, sponsorshipId] = ref.split(":");
    if (!sponsorshipId) {
      console.error("mercadopago-webhook: external_reference de patrocínio inválido", ref);
      return;
    }
    await admin
      .from("category_sponsorships")
      .update({ status: "active", mercadopago_payment_id: String(paymentId) })
      .eq("id", sponsorshipId);
    return;
  }

  /* "annual:" e "mensal:" são o mesmo caminho — pagamento único via
     Checkout Pro, que aceita Pix e boleto e não exige conta no Mercado Pago.
     Muda só o tamanho do período comprado. */
  if (ref.startsWith("annual:") || ref.startsWith("mensal:")) {
    const avulsoAnual = ref.startsWith("annual:");
    const cicloAvulso = avulsoAnual ? "annual" : "monthly";
    const [, professionalId, type] = ref.split(":");
    if (!professionalId || !type || !isSubscriptionType(type)) {
      console.error("mercadopago-webhook: external_reference avulso inválido", ref);
      return;
    }
    const until = await nextUntil(admin, professionalId, type, avulsoAnual);
    await admin
      .from("professionals")
      .update(professionalFieldsFor(type, until))
      .eq("id", professionalId);

    // Localiza a linha "pending" mais recente dessa assinatura anual para
    // este profissional+type (criada por mercadopago-create-annual-payment)
    // e a confirma.
    const { data: pending } = await admin
      .from("subscriptions")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("type", type)
      .eq("billing_cycle", cicloAvulso)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // `renewal_notified_at: null` zera o controle de aviso para o próximo
    // ciclo: o `renew-annual-plans` volta a poder avisar quando este novo
    // ano estiver perto de vencer.
    const confirmed = {
      status: "active",
      current_period_end: until,
      mercadopago_subscription_id: String(paymentId),
      auto_renew: false,
      renewal_notified_at: null,
    };

    if (pending) {
      await admin.from("subscriptions").update(confirmed).eq("id", pending.id);
      await vinculaPagamentoAAssinatura(admin, paymentId, pending.id);
      return;
    }

    // Sem linha pending: é o pagamento de uma RENOVAÇÃO gerada pelo cron
    // `renew-annual-plans` (que não cria linha nova, só avisa por e-mail com
    // o link). Estende a linha ativa existente em vez de duplicá-la.
    const { data: activeRow } = await admin
      .from("subscriptions")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("type", type)
      .eq("billing_cycle", cicloAvulso)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRow) {
      await admin.from("subscriptions").update(confirmed).eq("id", activeRow.id);
      await vinculaPagamentoAAssinatura(admin, paymentId, activeRow.id);
    } else {
      await admin.from("subscriptions").insert({
        professional_id: professionalId,
        type,
        billing_cycle: cicloAvulso,
        ...confirmed,
      });
    }
    return;
  }

  // Cobrança RECORRENTE de uma preapproval (mensal ou anual): o Mercado Pago
  // manda um evento `payment` a cada renovação, carregando o mesmo
  // external_reference da preapproval ("<id>:<type>" ou "<id>:<type>:annual").
  // Sem tratar isso, a assinatura seria cobrada de novo mas o benefício
  // expiraria — a renovação precisa empurrar o "..._until" para frente.
  const parts = ref.split(":");
  if ((parts.length === 2 || parts.length === 3) && isSubscriptionType(parts[1])) {
    const [professionalId, type, cycleSuffix] = parts;
    const isAnnual = cycleSuffix === "annual";
    const until = await nextUntil(admin, professionalId, type, isAnnual);

    await admin
      .from("professionals")
      .update(professionalFieldsFor(type, until))
      .eq("id", professionalId);

    const { data: row } = await admin
      .from("subscriptions")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("type", type)
      .eq("billing_cycle", isAnnual ? "annual" : "monthly")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (row) {
      await admin
        .from("subscriptions")
        .update({ status: "active", current_period_end: until, auto_renew: true })
        .eq("id", row.id);
    }
    return;
  }

  console.log("mercadopago-webhook: payment aprovado com external_reference não reconhecido:", ref);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("webhook mercadopago recebido:", JSON.stringify(body));

    const type: string = body?.type ?? body?.topic ?? "";
    const id: string | undefined = body?.data?.id ?? body?.id;

    if (!id || !MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (!(await assinaturaValida(req, String(id)))) {
      // 200 de propósito: responder 401 ensina a quem está sondando que o
      // endereço existe e é interessante. Para o Mercado Pago legítimo isso
      // nunca acontece.
      console.error("webhook mercadopago: assinatura inválida, ignorado");
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    try {
      if (type === "subscription_preapproval" || type === "preapproval") {
        await handlePreapproval(admin, String(id));
      } else if (type === "payment") {
        await handlePayment(admin, String(id));
      } else {
        console.log("mercadopago-webhook: tipo de evento ignorado:", type);
      }
    } catch (innerErr: any) {
      // Falha de rede/parse ao consultar a API do Mercado Pago não deve
      // derrubar a function — loga e responde 200 do mesmo jeito.
      console.error("mercadopago-webhook: erro ao processar evento:", innerErr?.message ?? innerErr);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error("mercadopago-webhook: erro inesperado:", err?.message ?? err);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
});
