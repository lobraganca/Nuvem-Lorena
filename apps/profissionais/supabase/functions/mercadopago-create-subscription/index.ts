// Edge Function: cria uma assinatura recorrente (preapproval) no Mercado
// Pago para o profissional autenticado — selo de verificação (R$10,90/mês)
// ou turbinar anúncio (destaque pago).
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN        — access token do Mercado Pago (NUNCA no cliente)
//   SUPABASE_URL            — injetada automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injetada automaticamente pelo Supabase
//   PUBLIC_APP_URL          — URL pública do app, para back_url do checkout
//
// Deploy: supabase functions deploy mercadopago-create-subscription

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";

const PRICES: Record<string, number> = {
  verification: 10.9,
  boost: 19.9,
};

Deno.serve(async (req) => {
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
    if (!professionalId || !PRICES[type]) {
      return new Response(JSON.stringify({ error: "professionalId ou type inválidos." }), {
        status: 400,
      });
    }

    // Confirma que o profissional pertence a quem está pedindo a assinatura.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: professional, error: profError } = await admin
      .from("professionals")
      .select("id, owner_id, name")
      .eq("id", professionalId)
      .single();

    if (profError || !professional || professional.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Anúncio não encontrado ou não é seu." }), {
        status: 403,
      });
    }

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error:
            "MP_ACCESS_TOKEN não configurado no servidor. Defina com `supabase secrets set MP_ACCESS_TOKEN=...`.",
        }),
        { status: 500 }
      );
    }

    // Cria a assinatura recorrente (preapproval) no Mercado Pago.
    // Docs: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason:
          type === "verification"
            ? `Busca Itabirito — selo de verificação (${professional.name})`
            : `Busca Itabirito — turbinar anúncio (${professional.name})`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: PRICES[type],
          currency_id: "BRL",
        },
        back_url: `${PUBLIC_APP_URL}/painel`,
        external_reference: `${professionalId}:${type}`,
        payer_email: user.email,
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: "Falha ao criar assinatura no Mercado Pago.", details: mpData }), {
        status: 502,
      });
    }

    // Registra a assinatura como "pending" — o webhook a confirma depois.
    await admin.from("subscriptions").insert({
      professional_id: professionalId,
      type,
      mercadopago_subscription_id: mpData.id,
      status: "pending",
    });

    return new Response(JSON.stringify({ initPoint: mpData.init_point }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
});
