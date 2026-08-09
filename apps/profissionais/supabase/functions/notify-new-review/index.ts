// Edge Function: avisa por e-mail o dono de um anúncio que ele recebeu uma
// nova avaliação. Best-effort — chamada pelo client depois de `addReview`
// dar certo; se falhar, não desfaz a avaliação já salva.
//
// Variáveis de ambiente exigidas (mesmas de notify-suspension, ver README):
//   RESEND_API_KEY, RESEND_FROM_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy notify-new-review

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "procurô <avisos@DOMINIO-AINDA-NAO-DEFINIDO>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://www.procuroapp.com.br";

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

    const { professionalId, rating } = await req.json();
    if (!professionalId || !rating) {
      return new Response(JSON.stringify({ error: "professionalId e rating são obrigatórios." }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: professional, error: profError } = await admin
      .from("professionals")
      .select("name, owner_id")
      .eq("id", professionalId)
      .single();
    if (profError || !professional) {
      return new Response(JSON.stringify({ error: "Anúncio não encontrado." }), { status: 404 });
    }

    // Não avisa quando a pessoa avalia o próprio anúncio (não deveria
    // acontecer, mas evita e-mail bobo se acontecer).
    if (professional.owner_id === caller.id) {
      return new Response(JSON.stringify({ sent: false, reason: "Auto-avaliação, sem aviso." }), { status: 200 });
    }

    const { data: ownerUser, error: ownerError } = await admin.auth.admin.getUserById(professional.owner_id);
    const ownerEmail = ownerUser?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("notify-new-review: não foi possível achar o e-mail do dono", ownerError);
      return new Response(JSON.stringify({ sent: false, reason: "Dono sem e-mail cadastrado." }), { status: 200 });
    }

    if (!RESEND_API_KEY) {
      console.warn("notify-new-review: RESEND_API_KEY não configurada — pulando envio de e-mail.");
      return new Response(JSON.stringify({ sent: false, reason: "RESEND_API_KEY não configurada." }), {
        status: 200,
      });
    }

    const profileLink = `${SITE_URL}/profissional/${professionalId}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: ownerEmail,
        subject: `Seu anúncio "${professional.name}" recebeu uma nova avaliação`,
        text:
          `Olá,\n\nSeu anúncio "${professional.name}" recebeu uma avaliação nova no procurô: ${rating} estrela(s).\n\n` +
          `Veja o seu perfil e responda a avaliação em: ${profileLink}\n\n` +
          `Equipe procurô`,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("notify-new-review: falha ao enviar via Resend", resendResponse.status, errText);
      return new Response(JSON.stringify({ sent: false, reason: "Falha no envio do e-mail." }), { status: 200 });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-review: erro inesperado", err);
    return new Response(JSON.stringify({ sent: false, reason: "Erro inesperado." }), { status: 200 });
  }
});
