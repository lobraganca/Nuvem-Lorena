// Edge Function: cancela a assinatura mensal da empresa.
//
// ── POR QUE ISTO NÃO É OPCIONAL ────────────────────────────────────────
//
// Esconder ou dificultar o cancelamento de uma assinatura é infração do
// Código de Defesa do Consumidor — não é uma escolha de produto. O app já
// sabia disso: a tela "Suas assinaturas" continua existindo até dentro do
// app da Play Store, onde tudo que vende foi escondido, exatamente porque
// tirar o botão de cancelar seria trocar uma regra de loja por uma de lei.
//
// O que faltava era o outro lado: o botão existia, mas não havia como
// cancelar de verdade no Mercado Pago, porque o número da assinatura não
// era guardado em lugar nenhum. A 0130 criou esse lugar
// (`companies.mp_preapproval_id`), e esta função usa.
//
// ── O QUE ELA NÃO FAZ ──────────────────────────────────────────────────
//
// Não tira o plano no ato, e não devolve dinheiro.
//
// Quem cancela no dia 20 já pagou até o dia 30: desligar na hora seria
// ficar com o dinheiro e recolher o serviço. O plano vence sozinho na data
// que já estava marcada — `plano_ate` — e o que se desliga é a RENOVAÇÃO.
//
// A devolução tem regra própria e mora noutro lugar: o pedido de reembolso
// (`ReembolsoPage` e a 0124), que conhece o prazo de arrependimento de 7
// dias do art. 49 do CDC. Duas contas diferentes escritas em dois lugares
// divergiriam, e a que a lei não perdoa errar é a do reembolso.
//
// ── E ELA NÃO CONFIA NO QUE CHEGA ──────────────────────────────────────
//
// Nenhum id vem da requisição: a empresa é encontrada pelo dono, que sai
// do token. Sem isso, trocar um id na chamada cancelaria a assinatura de
// outra pessoa.
//
// Deploy: entra no DO_EI de `.github/workflows/publicar-functions.yml`.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

function erro(mensagem: string, status: number): Response {
  return new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(comCors(async (req) => {
  if (req.method !== "POST") return erro("Método não permitido.", 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return erro("Servidor sem configuração do banco.", 500);
  }

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao.startsWith("Bearer ")) return erro("Entre na sua conta.", 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: dados, error: erroDoUsuario } = await admin.auth.getUser(
    autorizacao.replace("Bearer ", "")
  );
  const usuario = dados?.user;
  if (erroDoUsuario || !usuario) return erro("Entre na sua conta.", 401);

  const { data: empresa, error: erroDaEmpresa } = await admin
    .from("companies")
    .select("id, mp_preapproval_id, plano_ate")
    .eq("owner_id", usuario.id)
    .limit(1)
    .maybeSingle();
  if (erroDaEmpresa) return erro("Não consegui ler sua empresa.", 500);
  if (!empresa) return erro("Não achei sua empresa.", 404);

  /* Sem assinatura no Mercado Pago não há o que cancelar lá — mas ainda
     pode haver a marca de "renova sozinho" aqui, de um estado antigo.
     Desligar a marca e responder que deu certo é o certo: para quem tocou
     no botão, o resultado pedido aconteceu. */
  if (!empresa.mp_preapproval_id) {
    await admin
      .from("companies")
      .update({ plano_recorrente: false })
      .eq("id", empresa.id);
    return new Response(
      JSON.stringify({ cancelada: true, valeAte: empresa.plano_ate }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!MP_ACCESS_TOKEN) {
    return erro("A cobrança não está configurada. Fale com o suporte.", 503);
  }

  const resposta = await fetch(
    `https://api.mercadopago.com/preapproval/${empresa.mp_preapproval_id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );

  /* 404 = a assinatura não existe mais do lado deles (cancelada pelo app
     do Mercado Pago, por exemplo). O pedido da pessoa foi atendido; o que
     falta é só acertar o registro daqui. */
  if (!resposta.ok && resposta.status !== 404) {
    const detalhe = await resposta.text().catch(() => "");
    console.error("Mercado Pago recusou o cancelamento:", resposta.status, detalhe);
    /* NÃO desliga a marca aqui. Dizer "cancelado" com a cobrança viva no
       Mercado Pago é o pior erro possível desta tela: a empresa para de
       acompanhar e o cartão continua sendo debitado. */
    return erro(
      "Não consegui cancelar agora. Tente de novo em alguns minutos — " +
        "e, se continuar, fale com a gente que cancelamos na hora.",
      502
    );
  }

  const { error } = await admin
    .from("companies")
    .update({ plano_recorrente: false, mp_preapproval_id: null })
    .eq("id", empresa.id);

  if (error) {
    /* Cancelou lá e não conseguiu gravar aqui. Ninguém será cobrado de
       novo — o estrago é a tela dizer "renova em X dias" até o webhook do
       cancelamento chegar e acertar. Vale contar isso no log com todas as
       letras, para quem for investigar não procurar no lugar errado. */
    console.error("CANCELOU NO MP MAS NÃO GRAVOU — empresa", empresa.id, error);
  }

  return new Response(
    JSON.stringify({ cancelada: true, valeAte: empresa.plano_ate }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}));
