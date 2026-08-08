// Edge Function: cria uma preferência de pagamento avulso (Checkout Pro, NÃO
// recorrente — diferente do preapproval usado pelo selo/boost) no Mercado
// Pago, para o profissional autenticado comprar um pacote de créditos de
// contato (modo "pagar por contato").
//
// A confirmação do pagamento (creditar o saldo em `lead_credits`) segue o
// MESMO padrão esqueleto do webhook de assinaturas (`mercadopago-webhook`):
// aqui só criamos a preferência e devolvemos o link de checkout. Quando o
// pagamento for aprovado, o Mercado Pago chama o webhook configurado no
// painel, que deve consultar `GET /v1/payments/{id}`, ler o
// `external_reference` (formato "credits:<professionalId>:<quantity>") e
// então fazer um upsert em `lead_credits` somando `quantity` ao saldo (criar
// a linha com `on conflict (professional_id) do update set balance =
// lead_credits.balance + excluded.balance`). Isso ainda não está
// implementado — ver TODO no `mercadopago-webhook`.
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL
//
// Deploy: supabase functions deploy mercadopago-buy-credits

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";

const PRICE_PER_LEAD = 2.9; // R$2,90 por crédito de contato
const ALLOWED_QUANTITIES = [10, 25, 50];

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

    const { professionalId, quantity } = await req.json();
    if (!professionalId || !ALLOWED_QUANTITIES.includes(quantity)) {
      return new Response(JSON.stringify({ error: "professionalId ou quantity inválidos." }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: professional, error: profError } = await admin
      .from("professionals")
      .select("id, owner_id, name")
      .eq("id", professionalId)
      .single();

    if (profError || !professional || professional.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Anúncio não encontrado ou não é seu." }), { status: 403 });
    }

    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "MP_ACCESS_TOKEN não configurado no servidor. Defina com `supabase secrets set MP_ACCESS_TOKEN=...`.",
        }),
        { status: 500 }
      );
    }

    // Cria a preferência de pagamento avulso (Checkout Pro) no Mercado Pago.
    // Docs: https://www.mercadopago.com.br/developers/pt/reference/preferences/_preferences/post
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `Busca Itabirito — ${quantity} créditos de contato (${professional.name})`,
            quantity: 1,
            unit_price: Number((PRICE_PER_LEAD * quantity).toFixed(2)),
            currency_id: "BRL",
          },
        ],
        back_urls: {
          success: `${PUBLIC_APP_URL}/painel`,
          failure: `${PUBLIC_APP_URL}/painel`,
          pending: `${PUBLIC_APP_URL}/painel`,
        },
        auto_return: "approved",
        external_reference: `credits:${professionalId}:${quantity}`,
        payer: { email: user.email },
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: "Falha ao criar pagamento no Mercado Pago.", details: mpData }), {
        status: 502,
      });
    }

    return new Response(JSON.stringify({ initPoint: mpData.init_point }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
});
