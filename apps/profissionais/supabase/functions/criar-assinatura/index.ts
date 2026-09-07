// Edge Function: abre a assinatura que renova sozinha (Mercado Pago).
//
// A dona: "quero a assinatura que renova sozinha."
//
// É irmã da `criar-pagamento`. A diferença está no que se cria do lado do
// Mercado Pago: lá é uma "preferência" (uma cobrança, uma vez), aqui é um
// "preapproval" (uma autorização de cobrança mensal, até alguém cancelar).
//
// ── O QUE ELA NÃO FAZ, DE PROPÓSITO ────────────────────────────────────
//
// Não toca em cartão. O `preapproval` é criado com status "pending" e sem
// token de cartão nenhum, e o Mercado Pago devolve um endereço onde a
// empresa autoriza a cobrança na tela DELES. Assim nenhum dado de cartão
// passa pelo Ei — nem pelo navegador, nem por aqui, nem pelo banco.
//
// ── E O QUE ELA DEIXA CLARO PARA QUEM VAI PAGAR ────────────────────────
//
// Assinatura no Mercado Pago aceita SÓ CARTÃO. Não tem Pix nem boleto.
// Quem não tem cartão continua tendo a opção de uma vez só, que é a
// `criar-pagamento` — e é por isso que as duas existem, em vez de uma
// substituir a outra.
//
// ── AS MESMAS TRÊS PROTEÇÕES DA IRMÃ ───────────────────────────────────
//
//   1. o PREÇO sai de `_shared/precosDoEi.ts`, aqui dentro, nunca do que
//      chega na requisição;
//   2. o TOKEN do Mercado Pago não sai do servidor;
//   3. a EMPRESA é procurada pelo dono (o usuário do token), e não por um
//      id que veio na requisição.
//
// Deploy: entra no DO_EI de `.github/workflows/publicar-functions.yml`.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comCors } from "../_shared/cors.ts";
import { PLANOS, ehPlanoCobravel } from "../_shared/precosDoEi.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://www.empregoitabirito.com.br").replace(/\/$/, "");

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
  if (!MP_ACCESS_TOKEN) {
    return erro("A cobrança ainda não está ligada (falta MP_ACCESS_TOKEN).", 503);
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

  let corpo: any = {};
  try {
    corpo = await req.json();
  } catch {
    return erro("Pedido malformado.", 400);
  }

  const plano = String(corpo?.plano ?? "");
  if (!ehPlanoCobravel(plano)) {
    return erro("Este plano não é vendido pelo site.", 400);
  }

  /* O e-mail é obrigatório no preapproval — é a identidade do assinante do
     lado do Mercado Pago. Quem entrou por telefone (que é a maioria aqui)
     pode não ter e-mail nenhum na conta, e aí a assinatura não tem como
     ser criada. Dizer isso na cara é melhor do que um erro do Mercado
     Pago em inglês, que não explica o que fazer. */
  const email = usuario.email ?? String(corpo?.email ?? "").trim();
  if (!email || !email.includes("@")) {
    return erro(
      "Para assinar com renovação automática é preciso um e-mail na conta. " +
        "Você pode pagar uma vez só, sem e-mail, e renovar quando quiser.",
      400
    );
  }

  const { data: empresa, error: erroDaEmpresa } = await admin
    .from("companies")
    .select("id, mp_preapproval_id")
    .eq("owner_id", usuario.id)
    .limit(1)
    .maybeSingle();
  if (erroDaEmpresa) return erro("Não consegui ler sua empresa.", 500);
  if (!empresa) return erro("Cadastre sua empresa antes de assinar.", 400);

  /* Já tem assinatura ativa? Criar outra cobraria duas vezes por mês, e a
     empresa só descobriria no extrato. Trocar de plano é cancelar a
     anterior primeiro — o que a tela faz por ela. */
  if (empresa.mp_preapproval_id) {
    return erro(
      "Você já tem uma assinatura ativa. Cancele a atual antes de assinar outro plano.",
      409
    );
  }

  const { nome, centavos } = PLANOS[plano];

  const { data: pedido, error: erroDoPedido } = await admin
    .from("pedidos")
    .insert({
      user_id: usuario.id,
      tipo: "assinatura_empresa",
      plano,
      company_id: empresa.id,
      /* 30 dias por mensalidade — a mesma régua do avulso. O valor fica
         gravado pelo mesmo motivo da 0129: quem assinou por R$ 89,90
         assinou por R$ 89,90, e uma mudança de preço não muda contrato
         que já está em curso. */
      dias: 30,
      centavos,
    })
    .select("id")
    .single();

  if (erroDoPedido || !pedido) {
    console.error("não gravei o pedido da assinatura:", erroDoPedido);
    return erro("Não consegui abrir a assinatura. Tente de novo.", 500);
  }

  const assinatura = {
    reason: `${nome} — Ei Emprego`,
    external_reference: pedido.id,
    payer_email: email,
    back_url: `${SITE}/pagamento-ok?pedido=${pedido.id}`,
    /* "pending" é o que faz o Mercado Pago devolver o `init_point`: a
       empresa autoriza na tela deles. Com "authorized" ele exigiria um
       token de cartão, e aí o cartão passaria por aqui. */
    status: "pending",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: centavos / 100,
      currency_id: "BRL",
    },
  };

  const resposta = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": pedido.id,
    },
    body: JSON.stringify(assinatura),
  });

  const retorno = await resposta.json().catch(() => ({}));

  if (!resposta.ok || !retorno?.init_point) {
    await admin.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
    console.error("Mercado Pago recusou a assinatura:", resposta.status, retorno);
    return erro("O Mercado Pago não abriu a assinatura. Tente de novo.", 502);
  }

  /* O número da assinatura fica no PEDIDO agora, e só vai para a empresa
     quando o Mercado Pago confirmar que ela foi autorizada (é o webhook
     que faz isso). Gravar em `companies` já seria dizer que existe uma
     assinatura ativa antes de alguém ter autorizado nada — e aí a tela
     mostraria "renova em 30 dias" para quem desistiu na tela seguinte. */
  await admin
    .from("pedidos")
    .update({ mp_preapproval_id: String(retorno.id ?? "") })
    .eq("id", pedido.id);

  return new Response(
    JSON.stringify({ pedidoId: pedido.id, url: retorno.init_point }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}));
