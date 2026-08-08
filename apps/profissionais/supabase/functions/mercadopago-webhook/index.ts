// Edge Function: webhook do Mercado Pago para assinaturas (preapproval).
//
// ESQUELETO — a criação da assinatura (Edge Function
// mercadopago-create-subscription) já está implementada; a confirmação do
// pagamento aqui está deixada como esqueleto documentado, pronto para
// completar quando o app for para produção:
//
// 1. Cadastre esta URL como webhook no painel do Mercado Pago:
//      https://<projeto>.functions.supabase.co/mercadopago-webhook
// 2. O Mercado Pago envia um POST com { type, data: { id } } quando o status
//    de uma preapproval/pagamento muda.
// 3. TODO: consultar `GET /preapproval/{id}` na API do Mercado Pago (usando
//    MP_ACCESS_TOKEN) para confirmar o status real (nunca confiar cegamente
//    no corpo do webhook — ele pode ser forjado).
// 4. TODO: usar o `external_reference` (formato "<professionalId>:<type>")
//    devolvido pela consulta para localizar a linha em `subscriptions` pelo
//    mercadopago_subscription_id, e então:
//      - se status virou "authorized"/"active": marcar subscriptions.status,
//        subscriptions.current_period_end, e no professionals correspondente
//        setar verified=true, verified_until=... (tipo verification) ou
//        boosted=true, boosted_until=... (tipo boost).
//      - se status virou "cancelled"/"paused": refletir em subscriptions e
//        derrubar o verified/boosted no professional quando expirar.
// 5. Sempre responder 200 rapidamente — o Mercado Pago reenvia em caso de
//    erro/timeout.
//
// Este mesmo esqueleto também cobre as 3 novas fontes de renda avulsas
// (pagamentos via `checkout/preferences`, não preapproval):
//   - `external_reference = "credits:<professionalId>:<quantity>"` (compra
//     de créditos de contato, ver mercadopago-buy-credits): ao confirmar o
//     pagamento (`GET /v1/payments/{id}`, status "approved"), fazer upsert
//     em `lead_credits` somando `quantity` ao saldo.
//   - `external_reference = "sponsor:<sponsorshipId>"` (patrocínio de
//     categoria, ver mercadopago-sponsor-category): ao confirmar, marcar a
//     linha em `category_sponsorships` com `status = 'active'`. Um job
//     separado (não incluído neste app ainda) deve marcar `status =
//     'expired'` quando `ends_at` passar.
//   - `external_reference = "<professionalId>:plus"` (Empresa Plus, ver
//     mercadopago-create-plus-subscription): mesmo tratamento do selo/boost,
//     mas setando `professionals.plus_active`/`plus_until`.
// Nenhum desses três fluxos está implementado abaixo — todos ficam no mesmo
// estado "best-effort/esqueleto" documentado aqui, igual ao selo/boost.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log mínimo para depuração manual enquanto o fluxo completo não existe.
    console.log("webhook mercadopago recebido:", JSON.stringify(body));

    const preapprovalId: string | undefined = body?.data?.id;
    if (!preapprovalId || !MP_ACCESS_TOKEN) {
      // Sem id ou sem token configurado: apenas confirma recebimento.
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // --- A partir daqui é o esqueleto a completar (ver comentário acima) ---
    //
    // const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    //   headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    // });
    // const preapproval = await mpResp.json();
    // const [professionalId, type] = String(preapproval.external_reference ?? "").split(":");
    // if (preapproval.status === "authorized") {
    //   await admin
    //     .from("subscriptions")
    //     .update({ status: "active", current_period_end: ... })
    //     .eq("mercadopago_subscription_id", preapprovalId);
    //   const field = type === "verification"
    //     ? { verified: true, verified_until: ... }
    //     : { boosted: true, boosted_until: ... };
    //   await admin.from("professionals").update(field).eq("id", professionalId);
    // }

    void admin; // mantém a referência enquanto o corpo acima está comentado
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error("erro no webhook do mercado pago:", err?.message);
    // Responde 200 mesmo em erro interno para evitar reenvio agressivo
    // enquanto o handler está incompleto; ajuste ao completar o TODO acima.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
});
