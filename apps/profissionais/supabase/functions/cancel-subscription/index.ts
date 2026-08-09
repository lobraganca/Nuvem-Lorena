// Edge Function: cancela a assinatura de quem pediu e devolve o dinheiro
// quando a lei manda devolver.
//
// Duas regras do Código de Defesa do Consumidor moram aqui, e nenhuma delas
// pode depender de a tela ter feito a conta certa:
//
// 1. ARREPENDIMENTO (art. 49): compra fora do estabelecimento — e assinatura
//    contratada por app é isso — pode ser desfeita em até 7 dias corridos,
//    sem justificativa, com devolução integral do que foi pago. Aqui isso é
//    calculado a partir da data real da cobrança, no servidor.
//
// 2. CANCELAMENTO A QUALQUER TEMPO: depois dos 7 dias, ninguém fica preso.
//    A cobrança seguinte não acontece, e o que já foi pago vale até o fim do
//    período — o serviço não é cortado no meio de um mês já pago, porque
//    isso seria ficar com o dinheiro sem entregar o combinado.
//
// O cancelamento no Mercado Pago é feito primeiro. Se ele falhar, nada é
// gravado: marcar como cancelado aqui e continuar cobrando lá seria o pior
// resultado possível para quem pediu.
//
// Deploy: supabase functions deploy cancel-subscription

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

const DIAS_ARREPENDIMENTO = 7;

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await comoUsuario.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const { subscriptionId } = await req.json().catch(() => ({}));
    if (!subscriptionId) return json({ error: "Assinatura não informada." }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Dono confirmado no servidor: o id da assinatura vem do navegador, e
    // navegador não é fonte de autorização.
    const { data: assinatura } = await admin
      .from("subscriptions")
      .select("id, type, status, created_at, billing_cycle, mercadopago_subscription_id, professional_id, professionals!inner(owner_id)")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (!assinatura) return json({ error: "Assinatura não encontrada." }, 404);
    if ((assinatura as any).professionals?.owner_id !== user.id) {
      return json({ error: "Esta assinatura não é sua." }, 403);
    }
    if (assinatura.status === "cancelled") {
      return json({ jaCancelada: true });
    }

    const diasDesdeInicio =
      (Date.now() - new Date(assinatura.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const dentroDoArrependimento = diasDesdeInicio <= DIAS_ARREPENDIMENTO;

    // 1. Para de cobrar no Mercado Pago.
    if (assinatura.mercadopago_subscription_id && MP_ACCESS_TOKEN) {
      const resposta = await fetch(
        `https://api.mercadopago.com/preapproval/${assinatura.mercadopago_subscription_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );
      if (!resposta.ok) {
        const detalhe = await resposta.text();
        console.error("cancel-subscription: Mercado Pago recusou", detalhe);
        // Nada é gravado: dizer "cancelado" e continuar cobrando é o pior
        // resultado possível para quem pediu.
        return json(
          { error: "Não foi possível cancelar agora. Tente de novo em alguns minutos." },
          502
        );
      }
    }

    // 2. Dentro dos 7 dias: devolve o que foi pago.
    let reembolsado = false;
    if (dentroDoArrependimento && MP_ACCESS_TOKEN) {
      const { data: pagamentos } = await admin
        .from("processed_payments")
        .select("payment_id")
        .eq("subscription_id", assinatura.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const pagamento = pagamentos?.[0]?.payment_id;
      if (pagamento) {
        const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${pagamento}/refunds`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            // Sem isto, uma repetição do pedido devolveria o dinheiro duas
            // vezes — o Mercado Pago usa esta chave para reconhecer o mesmo
            // reembolso.
            "X-Idempotency-Key": `refund-${assinatura.id}`,
          },
        });
        reembolsado = resposta.ok;
        if (!resposta.ok) {
          console.error("cancel-subscription: reembolso recusado", await resposta.text());
        }
      }
    }

    // 3. Estado local. Fora dos 7 dias o benefício continua até a data já
    //    paga: cortar no meio de um mês pago seria ficar com o dinheiro sem
    //    entregar o combinado.
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", auto_renew: false })
      .eq("id", assinatura.id);

    if (reembolsado) {
      const campos: Record<string, unknown> =
        assinatura.type === "verification"
          ? { verified: false, verified_until: null }
          : assinatura.type === "boost"
            ? { boosted: false, boosted_until: null }
            : { plus_active: false, plus_until: null };
      await admin.from("professionals").update(campos).eq("id", assinatura.professional_id);
    }

    return json({ cancelada: true, reembolsado, dentroDoArrependimento });
  } catch (err: any) {
    console.error("cancel-subscription: erro inesperado", err?.message ?? err);
    return json({ error: "Erro inesperado ao cancelar." }, 500);
  }
});
