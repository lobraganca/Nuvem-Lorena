// Edge Function: cria uma assinatura ANUAL RECORRENTE (preapproval com
// `auto_recurring.frequency = 12` / `frequency_type = "months"`) no Mercado
// Pago para as 3 assinaturas do app (selo de verificação, turbinar anúncio,
// Empresa Plus), com 20% de desconto sobre 12x o valor mensal.
//
// Diferença para as outras functions de cobrança anual/mensal:
//   - `mercadopago-create-subscription` / `mercadopago-create-plus-subscription`
//     → preapproval de 1 mês (cartão, cobra todo mês).
//   - ESTA function → preapproval de 12 meses (cartão, cobra todo ano
//     sozinha). É recorrência de verdade: o dono não precisa fazer nada.
//   - `mercadopago-create-annual-payment` → pagamento ÚNICO via
//     checkout/preferences (aceita Pix/boleto, mas NÃO renova sozinho; a
//     renovação é avisada por e-mail pela function agendada
//     `renew-annual-plans`).
//
// `external_reference` = "<professionalId>:<type>:annual" — o sufixo
// `:annual` é o que faz o `mercadopago-webhook` dar validade de 1 ano em vez
// de 1 mês ao autorizar a preapproval (o formato mensal continua sendo
// "<professionalId>:<type>", sem sufixo).
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL
//
// Deploy: supabase functions deploy mercadopago-create-annual-subscription

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ehTipoValido, precoAnual, ROTULOS } from "../_shared/precos.ts";
import { comCors } from "../_shared/cors.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";


Deno.serve(comCors(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado." }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
    }

    const { professionalId, type } = await req.json();
    if (!professionalId || !ehTipoValido(type)) {
      return new Response(JSON.stringify({ error: "professionalId ou type inválidos." }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: professional, error: profError } = await admin
      .from("professionals")
      .select("id, owner_id, name, entity_type")
      .eq("id", professionalId)
      .single();

    if (profError || !professional || professional.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Anúncio não encontrado ou não é seu." }), { status: 403 });
    }

    if (type === "plus" && professional.entity_type !== "pj") {
      return new Response(
        JSON.stringify({ error: "Empresa Plus só está disponível para anúncios de pessoa jurídica." }),
        { status: 400 }
      );
    }

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "MP_ACCESS_TOKEN não configurado no servidor. Defina com `supabase secrets set MP_ACCESS_TOKEN=...`.",
        }),
        { status: 500 }
      );
    }

    const price = precoAnual(type, professional.entity_type === "pj" ? "pj" : "pf");

    // Assinatura recorrente ANUAL: o Mercado Pago cobra o cartão sozinho a
    // cada 12 meses, sem ação do dono do anúncio.
    // Docs: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: `procurô — ${ROTULOS[type]} (${professional.name}) — plano anual com 20% de desconto, renovação automática`,
        auto_recurring: {
          frequency: 12,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "BRL",
        },
        back_url: `${PUBLIC_APP_URL}/painel`,
        external_reference: `${professionalId}:${type}:annual`,
        payer_email: user.email,
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: "Falha ao criar assinatura no Mercado Pago.", details: mpData }), {
        status: 502,
      });
    }

    // Registra a assinatura como "pending" — o webhook a confirma depois
    // (marcando `..._until` de 1 ano quando a preapproval ficar authorized).
    // `auto_renew: true` porque o Mercado Pago renova sozinho: esta linha
    // NUNCA deve receber o e-mail de aviso do `renew-annual-plans`.
    await admin.from("subscriptions").insert({
      professional_id: professionalId,
      type,
      mercadopago_subscription_id: mpData.id,
      billing_cycle: "annual",
      auto_renew: true,
      status: "pending",
    });

    return new Response(JSON.stringify({ initPoint: mpData.init_point, amount: price }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
}));
