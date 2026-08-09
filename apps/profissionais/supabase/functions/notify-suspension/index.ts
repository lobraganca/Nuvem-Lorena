// Edge Function: avisa por e-mail o dono de um anúncio que ele foi tirado
// do ar pelo painel administrativo.
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   RESEND_API_KEY             — API key da Resend (https://resend.com).
//                                 Sem ela configurada, a function loga o
//                                 aviso e retorna `sent: false` em vez de
//                                 quebrar — a suspensão no banco NÃO
//                                 depende do e-mail funcionar.
//   RESEND_FROM_EMAIL           — remetente verificado na Resend
//                                 (ex: "procurô <avisos@seudominio.com>")
//   SUPABASE_URL                — injetada automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY   — injetada automaticamente pelo Supabase
//
// Deploy: supabase functions deploy notify-suspension
//
// Passo a passo para configurar a Resend (ver também README, seção
// "Painel administrativo"):
//   1. Crie uma conta em https://resend.com (tem plano gratuito).
//   2. Verifique um domínio ou use o domínio de teste da Resend.
//   3. Gere uma API key em API Keys → Create API Key.
//   4. `supabase secrets set RESEND_API_KEY=re_xxx`
//   5. `supabase secrets set RESEND_FROM_EMAIL="procurô <avisos@seudominio.com>"`

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "procurô <avisos@buscaitabirito.app>";

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
      data: { user: caller },
    } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Só admin pode disparar este aviso.
    const { data: isAdminRow } = await admin.from("admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "Acesso restrito." }), { status: 403 });
    }

    const { professionalId, reason } = await req.json();
    if (!professionalId) {
      return new Response(JSON.stringify({ error: "professionalId é obrigatório." }), { status: 400 });
    }

    const { data: professional, error: profError } = await admin
      .from("professionals")
      .select("name, owner_id")
      .eq("id", professionalId)
      .single();
    if (profError || !professional) {
      return new Response(JSON.stringify({ error: "Anúncio não encontrado." }), { status: 404 });
    }

    const { data: ownerUser, error: ownerError } = await admin.auth.admin.getUserById(professional.owner_id);
    const ownerEmail = ownerUser?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("notify-suspension: não foi possível achar o e-mail do dono", ownerError);
      return new Response(JSON.stringify({ sent: false, reason: "Dono sem e-mail cadastrado." }), { status: 200 });
    }

    if (!RESEND_API_KEY) {
      console.warn(
        "notify-suspension: RESEND_API_KEY não configurada — pulando envio de e-mail (suspensão já foi aplicada normalmente)."
      );
      return new Response(JSON.stringify({ sent: false, reason: "RESEND_API_KEY não configurada." }), {
        status: 200,
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: ownerEmail,
        subject: `Seu anúncio "${professional.name}" foi removido do procurô`,
        text:
          `Olá,\n\nSeu anúncio "${professional.name}" foi tirado do ar pela moderação do procurô.\n\n` +
          `Motivo informado: ${reason || "não especificado"}\n\n` +
          `Se você acredita que isso foi um engano, responda este e-mail para revisão.\n\n` +
          `Equipe procurô`,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("notify-suspension: falha ao enviar via Resend", resendResponse.status, errText);
      return new Response(JSON.stringify({ sent: false, reason: "Falha no envio do e-mail." }), { status: 200 });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-suspension: erro inesperado", err);
    return new Response(JSON.stringify({ sent: false, reason: "Erro inesperado." }), { status: 200 });
  }
});
