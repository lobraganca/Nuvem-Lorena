// Edge Function: cria uma preferência de pagamento avulso (Checkout Pro, NÃO
// recorrente) no Mercado Pago para a alternativa "plano anual à vista" das
// 3 assinaturas recorrentes (selo de verificação, turbinar anúncio, Empresa
// Plus). Diferente de `mercadopago-create-subscription`/
// `mercadopago-create-plus-subscription` (que usam `/preapproval`, só
// cartão), este fluxo aceita Pix/cartão/boleto automaticamente, com 20% de
// desconto sobre 12x o valor mensal.
//
// Este é o único caminho de assinatura que NÃO renova sozinho: Pix e boleto
// não têm débito automático na API do Mercado Pago. Quem quer o anual
// renovando sozinho usa `mercadopago-create-annual-subscription` (preapproval
// de 12 meses, cartão). Para que este caminho não dependa da memória do
// dono do anúncio, a Edge Function agendada `renew-annual-plans` roda 1x/dia,
// acha os planos vencendo em até 7 dias, já gera a nova cobrança com esta
// mesma lógica e manda o link por e-mail.
//
// A confirmação do pagamento (marcar verified/boosted/plus_active com
// `..._until` de 1 ano) é feita pelo `mercadopago-webhook`, tratando
// `external_reference = "annual:<professionalId>:<type>"`.
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL
//
// Deploy: supabase functions deploy mercadopago-create-annual-payment

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
            title: `procurô — ${ROTULOS[type]} (${professional.name}) — plano anual, pagamento único, com 20% de desconto`,
            quantity: 1,
            unit_price: price,
            currency_id: "BRL",
          },
        ],
        back_urls: {
          success: `${PUBLIC_APP_URL}/painel`,
          failure: `${PUBLIC_APP_URL}/painel`,
          pending: `${PUBLIC_APP_URL}/painel`,
        },
        auto_return: "approved",
        external_reference: `annual:${professionalId}:${type}`,
        payer: { email: user.email },
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: "Falha ao criar pagamento no Mercado Pago.", details: mpData }), {
        status: 502,
      });
    }

    // Registra a assinatura anual como "pending" — o webhook a confirma
    // depois (marcando verified/boosted/plus_active com `..._until` de 1 ano).
    // `auto_renew: false` porque este caminho é pagamento ÚNICO (Pix/boleto
    // não têm débito automático): é exatamente esta marcação que faz a
    // function agendada `renew-annual-plans` avisar o dono por e-mail, com o
    // link da nova cobrança, quando o plano estiver perto de vencer.
    await admin.from("subscriptions").insert({
      professional_id: professionalId,
      type,
      billing_cycle: "annual",
      auto_renew: false,
      status: "pending",
    });

    return new Response(JSON.stringify({ initPoint: mpData.init_point, amount: price }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
}));
