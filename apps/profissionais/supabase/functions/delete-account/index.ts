// Edge Function: apaga a conta de quem pediu, e tudo que estava pendurado
// nela.
//
// Precisa existir do lado do servidor porque apagar um usuário exige a
// service_role key, que nunca pode chegar ao navegador. O que o app manda é
// só o token de quem está logado; quem a função apaga é sempre o dono desse
// token — não há como pedir a exclusão da conta de outra pessoa.
//
// O efeito em cascata vem do próprio banco: `profiles.id` referencia
// `auth.users` com `on delete cascade`, e anúncios, avaliações, favoritos e
// créditos referenciam `profiles` do mesmo jeito. Apagar o usuário derruba
// tudo em sequência, sem sobrar rastro órfão.
//
// Os pedidos de contato que a pessoa enviou a profissionais são exceção
// deliberada: `requester_id` vira null e o pedido permanece. O profissional
// do outro lado precisa continuar vendo o nome e telefone de quem o chamou —
// apagar isso quebraria o trabalho dele, não a privacidade dela.
//
// Deploy: supabase functions deploy delete-account

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado." }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await comoUsuario.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error("delete-account: falha ao apagar usuário", user.id, error);
      return new Response(JSON.stringify({ error: "Não foi possível apagar a conta agora." }), { status: 500 });
    }

    console.log("delete-account: conta apagada", user.id);
    return new Response(JSON.stringify({ apagada: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("delete-account: erro inesperado", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
});
