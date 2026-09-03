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
import { comCors } from "../_shared/cors.ts";
import { cancelarUmaAssinatura } from "../_shared/cancelarAssinaturas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(comCors(async (req) => {
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

    const resultado = await cancelarUmaAssinatura(
      { admin, mpAccessToken: MP_ACCESS_TOKEN },
      assinatura
    );

    if (!resultado.cancelada) {
      // Nada foi gravado: dizer "cancelado" e continuar cobrando é o pior
      // resultado possível para quem pediu.
      return json(
        { error: resultado.erro ?? "Não foi possível cancelar agora. Tente de novo em alguns minutos." },
        502
      );
    }

    return json({
      cancelada: resultado.cancelada,
      reembolsado: resultado.reembolsado,
      dentroDoArrependimento: resultado.dentroDoArrependimento,
    });
  } catch (err: any) {
    console.error("cancel-subscription: erro inesperado", err?.message ?? err);
    return json({ error: "Erro inesperado ao cancelar." }, 500);
  }
}));
