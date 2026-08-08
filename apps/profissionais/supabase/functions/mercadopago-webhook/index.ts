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
// no formato "<professionalId>:<type>" (type = verification|boost|plus):
//   - subscriptions: status='active', current_period_end = agora + 1 mês,
//     localizada por mercadopago_subscription_id.
//   - professionals: marca o campo correspondente
//     (verified/verified_until, boosted/boosted_until, plus_active/
//     plus_until) com "..._until" = agora + 1 mês.
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
//     único, 20% off) — mesmo efeito da preapproval authorized, mas
//     "..._until" = agora + 1 ano, e a linha em subscriptions (mais recente
//     pending do profissional+type+billing_cycle='annual') vira
//     status='active', current_period_end = agora + 1 ano.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

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

async function handlePreapproval(admin: Admin, preapprovalId: string) {
  const resp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!resp.ok) {
    console.error("mercadopago-webhook: falha ao consultar preapproval", preapprovalId, resp.status);
    return;
  }
  const preapproval = await resp.json();
  const [professionalId, type] = String(preapproval.external_reference ?? "").split(":");
  if (!professionalId || !type || !isSubscriptionType(type)) {
    console.error("mercadopago-webhook: external_reference inválido em preapproval", preapproval.external_reference);
    return;
  }

  if (preapproval.status === "authorized") {
    const until = addMonths(new Date(), 1).toISOString();
    await admin
      .from("subscriptions")
      .update({ status: "active", current_period_end: until })
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

  const ref: string = String(payment.external_reference ?? "");

  if (ref.startsWith("credits:")) {
    const [, professionalId, quantityStr] = ref.split(":");
    const quantity = Number(quantityStr);
    if (!professionalId || !Number.isFinite(quantity) || quantity <= 0) {
      console.error("mercadopago-webhook: external_reference de créditos inválido", ref);
      return;
    }
    const { data: existing } = await admin
      .from("lead_credits")
      .select("professional_id")
      .eq("professional_id", professionalId)
      .maybeSingle();
    if (existing) {
      // Supabase-js não faz "balance = balance + X" via update simples (não
      // há upsert incremental client-side) — como é uma compra avulsa (não
      // um clique concorrente como em consume_lead_credit), a janela de
      // corrida é aceitável para o padrão simples do resto do app.
      const { data: current } = await admin
        .from("lead_credits")
        .select("balance")
        .eq("professional_id", professionalId)
        .single();
      await admin
        .from("lead_credits")
        .update({ balance: (current?.balance ?? 0) + quantity, updated_at: new Date().toISOString() })
        .eq("professional_id", professionalId);
    } else {
      await admin.from("lead_credits").insert({ professional_id: professionalId, balance: quantity });
    }
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

  if (ref.startsWith("annual:")) {
    const [, professionalId, type] = ref.split(":");
    if (!professionalId || !type || !isSubscriptionType(type)) {
      console.error("mercadopago-webhook: external_reference anual inválido", ref);
      return;
    }
    const until = addYears(new Date(), 1).toISOString();
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
      .eq("billing_cycle", "annual")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending) {
      await admin
        .from("subscriptions")
        .update({ status: "active", current_period_end: until, mercadopago_subscription_id: String(paymentId) })
        .eq("id", pending.id);
    } else {
      await admin.from("subscriptions").insert({
        professional_id: professionalId,
        type,
        billing_cycle: "annual",
        status: "active",
        current_period_end: until,
        mercadopago_subscription_id: String(paymentId),
      });
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
