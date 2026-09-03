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
// O que o cascata NÃO alcança é o Storage: as fotos ficam em arquivos, não
// em linhas, e precisam ser removidas à mão — é o que esta função faz depois
// de apagar o usuário.
//
// Os pedidos de contato que a pessoa enviou a profissionais são exceção
// deliberada: `requester_id` vira null e o pedido permanece. O profissional
// do outro lado precisa continuar vendo o nome e telefone de quem o chamou —
// apagar isso quebraria o trabalho dele, não a privacidade dela.
//
// ── CANCELA A ASSINATURA ANTES DE APAGAR — 02/09 ────────────────────────
// A dona: "criar situação para exclusão de conta, reembolso... quero criar
// um sistema sustentavel que não precise da minha intervenção."
//
// Antes, apagar a conta não mexia no Mercado Pago: a linha de
// `subscriptions` sumia no cascata, mas a cobrança recorrente continuava
// lá, sem ninguém do lado do app para parar — a pessoa sumia do banco e o
// cartão dela continuava sendo cobrado. Quem descobria primeiro era ela,
// no extrato, ou a dona, pelo WhatsApp do suporte.
//
// Cancela (e reembolsa, se ainda dentro dos 7 dias do art. 49 do CDC)
// ANTES do `deleteUser`: depois de apagado não sobra `professionals.id`
// para procurar a assinatura. `cancelarAssinaturasDoProfissional` é a
// MESMA função que `cancel-subscription` usa quando a própria pessoa
// pede — extraída para as duas nunca divergirem na conta do
// arrependimento, que é a parte que a lei não perdoa errar.
//
// Uma falha aqui fica só no log e NÃO impede a exclusão: entre "a conta
// não foi apagada porque o Mercado Pago falhou" e "a conta foi apagada e
// uma cobrança ficou para cancelar à mão depois", o segundo é o dano menor
// — e ainda é raro, porque a maioria de quem apaga a conta nunca teve
// assinatura nenhuma.
//
// Deploy: supabase functions deploy delete-account

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comCors } from "../_shared/cors.ts";
import { cancelarAssinaturasDoProfissional } from "../_shared/cancelarAssinaturas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

/** O mesmo nome que `src/lib/storage.ts` usa para enviar as fotos. */
const BUCKET_DAS_FOTOS = "professional-photos";

Deno.serve(comCors(async (req) => {
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

    /* Cancela (e reembolsa, se dentro do prazo) qualquer assinatura ainda
       ativa — antes de tudo, porque depois do `deleteUser` não sobra
       `professionals.id` para achá-la. Ver o comentário no topo do
       arquivo. Sem `professionals.id` (quem nunca foi profissional, ou
       nunca assinou nada) a busca não acha nada e segue em frente. */
    const { data: meuProfissional } = await admin
      .from("professionals")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (meuProfissional) {
      const resultados = await cancelarAssinaturasDoProfissional(
        { admin, mpAccessToken: MP_ACCESS_TOKEN },
        meuProfissional.id
      );
      for (const r of resultados) {
        if (!r.cancelada) {
          console.error(
            "delete-account: assinatura NÃO cancelada, conta será apagada mesmo assim",
            user.id,
            r.erro
          );
        }
      }
    }

    /* As fotos são listadas ANTES de apagar o usuário, e removidas depois.
       O cascata do banco não alcança o Storage: ele apaga a linha que
       guardava o endereço da imagem e deixa o arquivo onde estava,
       público, acessível para sempre por quem tiver o link. Alguém que
       apagou a conta continuava com o próprio rosto no ar — e nós
       dizíamos, na política de privacidade e no formulário da Play
       Store, que apagávamos.

       A ordem importa. Listar primeiro porque depois de o usuário sumir
       ainda queremos os caminhos; apagar os arquivos só depois porque a
       conta é o que a pessoa pediu para apagar, e uma falha do Storage
       não pode impedir isso. Se a remoção falhar, os caminhos vão para o
       log — é o que permite alguém limpar à mão em vez de nunca ficar
       sabendo.

       Todas as fotos de uma pessoa vivem numa pasta com o id dela
       (`storage.ts` monta `${ownerId}/${carimbo}.jpg`), então listar a
       pasta é listar tudo que é dela. */
    const arquivos: string[] = [];
    const { data: listagem, error: erroDaListagem } = await admin.storage
      .from(BUCKET_DAS_FOTOS)
      .list(user.id, { limit: 1000 });
    if (erroDaListagem) {
      console.error("delete-account: não deu para listar as fotos", user.id, erroDaListagem);
    } else {
      for (const arquivo of listagem ?? []) arquivos.push(`${user.id}/${arquivo.name}`);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error("delete-account: falha ao apagar usuário", user.id, error);
      return new Response(JSON.stringify({ error: "Não foi possível apagar a conta agora." }), { status: 500 });
    }

    if (arquivos.length > 0) {
      const { error: erroDaRemocao } = await admin.storage.from(BUCKET_DAS_FOTOS).remove(arquivos);
      if (erroDaRemocao) {
        console.error("delete-account: FOTOS NÃO APAGADAS —", arquivos.join(", "), erroDaRemocao);
      } else {
        console.log("delete-account: fotos apagadas", arquivos.length);
      }
    }

    console.log("delete-account: conta apagada", user.id);
    return new Response(JSON.stringify({ apagada: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("delete-account: erro inesperado", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Erro inesperado." }), { status: 500 });
  }
}));
