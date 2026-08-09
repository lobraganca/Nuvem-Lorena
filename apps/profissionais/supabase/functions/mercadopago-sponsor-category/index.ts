// Edge Function: cria uma preferência de pagamento avulso (Checkout Pro,
// não recorrente) no Mercado Pago para o profissional patrocinar uma
// categoria (banner de destaque no topo da busca por N dias).
//
// Assim como em `mercadopago-buy-credits`, aqui só criamos a preferência e a
// linha em `category_sponsorships` com status "pending". A confirmação do
// pagamento (virar status "active") segue o MESMO padrão esqueleto do
// webhook de assinaturas: falta implementar, no `mercadopago-webhook`, o
// tratamento de pagamentos avulsos (não-preapproval) usando o
// `external_reference` no formato "sponsor:<sponsorshipId>" para localizar
// a linha e marcar `status = 'active'` quando o pagamento for aprovado (um
// job/cron separado, não incluído aqui, deve marcar `status = 'expired'`
// quando `ends_at` passar).
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL
//
// Deploy: supabase functions deploy mercadopago-sponsor-category

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comCors } from "../_shared/cors.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";

const PLANS: Record<number, number> = {
  7: 29.9,
  15: 49.9,
  30: 79.9,
};

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

    const { professionalId, category, city, days } = await req.json();
    if (!professionalId || !category || !city || !PLANS[days]) {
      return new Response(JSON.stringify({ error: "professionalId, category, city ou days inválidos." }), {
        status: 400,
      });
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

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    // Registra o patrocínio como "pending" antes de cobrar — vira "active"
    // quando o webhook confirmar o pagamento (ver TODO no cabeçalho).
    const { data: sponsorship, error: sponsorError } = await admin
      .from("category_sponsorships")
      .insert({
        professional_id: professionalId,
        category,
        city,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (sponsorError || !sponsorship) {
      return new Response(JSON.stringify({ error: "Falha ao registrar o patrocínio." }), { status: 500 });
    }

    // Cria a preferência de pagamento avulso (Checkout Pro) no Mercado Pago.
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `procurô — patrocínio de categoria "${category}" (${days} dias) — ${professional.name}`,
            quantity: 1,
            unit_price: PLANS[days],
            currency_id: "BRL",
          },
        ],
        back_urls: {
          success: `${PUBLIC_APP_URL}/painel`,
          failure: `${PUBLIC_APP_URL}/painel`,
          pending: `${PUBLIC_APP_URL}/painel`,
        },
        auto_return: "approved",
        external_reference: `sponsor:${sponsorship.id}`,
        payer: { email: user.email },
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      // Sem isto, o painel mostra "502" e mais nada; a causa real da recusa
      // fica invisível.
      console.error("Mercado Pago recusou:", mpResponse.status, JSON.stringify(mpData));
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
}));
