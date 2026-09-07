// Edge Function: o Mercado Pago avisa que um pagamento mudou de estado.
//
// É ela que liga o plano da empresa (ou o destaque de quem procura
// emprego) depois que o dinheiro entra. Ninguém a chama pela tela: quem
// bate aqui é o servidor do Mercado Pago.
//
// Endereço configurado no painel deles, em Webhooks:
//   https://<projeto>.supabase.co/functions/v1/retorno-do-pagamento
//
// ── ELA SOBE SEM JWT, E ISSO É DE PROPÓSITO ────────────────────────────
//
// O Mercado Pago não tem como apresentar um token do Supabase. Com a
// verificação ligada, TODA notificação seria recusada antes de chegar ao
// código — o pagamento seria aprovado lá e nunca viraria plano aqui, sem
// erro nenhum aparecendo em lugar nenhum. Por isso o nome dela entra na
// lista `sem_jwt` do workflow `publicar-functions.yml`.
//
// ── ENTÃO ELA SE DEFENDE SOZINHA, DE DUAS FORMAS ───────────────────────
//
//   1. A ASSINATURA. O Mercado Pago assina cada aviso com um segredo
//      (`MP_WEBHOOK_SECRET`, que o painel mostra ao salvar o webhook).
//      Aviso com assinatura errada é recusado.
//   2. A RECONSULTA, que é a defesa que vale mesmo. O conteúdo do aviso é
//      IGNORADO: dele só se aproveita o número do pagamento. O estado real
//      ("aprovado"?) e o valor são buscados na API do Mercado Pago, com o
//      token da conta. Quem forjar um aviso dizendo "pagamento aprovado"
//      não consegue forjar a resposta da API.
//
//      Por isso, se o segredo ainda não estiver configurado, a função
//      continua funcionando em vez de recusar tudo: sem ele a defesa fica
//      mais fraca, mas ainda é preciso existir um pagamento aprovado DE
//      VERDADE na conta da dona para qualquer coisa acontecer.
//
// ── E RESPONDE 200 QUASE SEMPRE ────────────────────────────────────────
//
// Resposta diferente de 200 faz o Mercado Pago reenviar o aviso por horas.
// Para o que não vai melhorar com repetição — pagamento recusado, pedido
// que não existe, aviso de outro tipo — o certo é dizer "recebi, obrigado"
// e parar. O 500 fica para o que UMA NOVA TENTATIVA resolve: o banco fora
// do ar, a API do Mercado Pago tropeçando.
//
// Deploy: `.github/workflows/publicar-functions.yml`, em DO_EI e sem_jwt.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

const ok = (texto = "ok") => new Response(texto, { status: 200 });

/**
 * Confere a assinatura que o Mercado Pago manda em `x-signature`.
 *
 * O cabeçalho vem como `ts=1699...,v1=abc...`, e o que se assina é
 * `id:<pagamento>;request-id:<x-request-id>;ts:<ts>;`.
 *
 * Devolve `true` quando não há segredo configurado — ver o cabeçalho do
 * arquivo: a reconsulta na API é a defesa que sustenta isso.
 */
async function assinaturaConfere(req: Request, idDoPagamento: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return true;

  const cabecalho = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!cabecalho) return false;

  let ts = "";
  let v1 = "";
  for (const parte of cabecalho.split(",")) {
    const [chave, valor] = parte.split("=", 2).map((p) => p?.trim() ?? "");
    if (chave === "ts") ts = valor;
    if (chave === "v1") v1 = valor;
  }
  if (!ts || !v1) return false;

  /* O id entra em minúsculas: é como o Mercado Pago monta o texto do lado
     dele, e um id alfanumérico com letra maiúscula daria assinaturas
     diferentes para o mesmo aviso. */
  const texto = `id:${idDoPagamento.toLowerCase()};request-id:${requestId};ts:${ts};`;

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  const meu = Array.from(new Uint8Array(assinado))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  /* Comparação de tempo constante: comparar com `===` vaza, pelo tempo de
     resposta, quantos caracteres do começo estavam certos. */
  if (meu.length !== v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < meu.length; i++) diferenca |= meu.charCodeAt(i) ^ v1.charCodeAt(i);
  return diferenca === 0;
}

/**
 * Até quando o benefício passa a valer.
 *
 * A partir de AGORA **ou** do que ainda resta, o que for maior.
 *
 * É diferente do `ligarPlano` do painel, que sempre conta de agora — e a
 * diferença é justa: lá quem liga é a dona, e o caso dela é a empresa que
 * sumiu por três meses e voltou (somar devolveria os três meses). Aqui
 * quem paga é a empresa, e o caso é a que paga ANTES de vencer para não
 * ficar sem. Contar de agora tiraria dela os dias que já pagou — quem
 * renova cedo seria punido por renovar cedo.
 */
function novaValidade(atual: string | null | undefined, dias: number): string {
  const resta = atual ? new Date(atual).getTime() : 0;
  const base = Math.max(Date.now(), resta || 0);
  return new Date(base + dias * 86_400_000).toISOString();
}

/**
 * A assinatura mudou de estado: foi autorizada, pausada ou cancelada.
 *
 * ── POR QUE A AUTORIZAÇÃO JÁ LIGA O PLANO ─────────────────────────────
 *
 * Porque no Mercado Pago a primeira cobrança acontece junto da
 * autorização. Esperar o aviso da mensalidade para ligar deixaria a
 * empresa pagando e sem plano por alguns minutos — e nesses minutos ela
 * tenta publicar a vaga, não consegue, e escreve para o suporte.
 *
 * Ligar aqui é seguro porque o estado vem da API deles, não do aviso: uma
 * assinatura "authorized" é uma assinatura com cobrança aceita.
 */
async function tratarAssinatura(admin: any, idDaAssinatura: string): Promise<Response> {
  const resposta = await fetch(`https://api.mercadopago.com/preapproval/${idDaAssinatura}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (resposta.status === 404) return ok("assinatura não existe");
  if (!resposta.ok) {
    console.error("não consegui consultar a assinatura:", resposta.status);
    return new Response("consulta falhou", { status: 500 });
  }

  const assinatura = await resposta.json().catch(() => null);
  if (!assinatura) return new Response("resposta ilegível", { status: 500 });

  const idDoPedido = String(assinatura.external_reference ?? "").trim();
  if (!idDoPedido) return ok("assinatura sem pedido");

  const { data: pedido, error: erroDoPedido } = await admin
    .from("pedidos")
    .select("id, plano, company_id, dias, status")
    .eq("id", idDoPedido)
    .maybeSingle();
  if (erroDoPedido) {
    console.error("não consegui ler o pedido da assinatura:", erroDoPedido);
    return new Response("banco fora", { status: 500 });
  }
  if (!pedido?.company_id || !pedido.plano) return ok("pedido não existe");

  /* ── CANCELADA OU PAUSADA ─────────────────────────────────────────
     O plano NÃO é desligado: quem cancela no meio do mês já pagou aquele
     mês, e tirar o acesso na hora seria ficar com o dinheiro e devolver o
     serviço. O que se desliga é a renovação — o plano vence sozinho na
     data que já estava marcada, e a 0124 (reembolso) segue mandando no
     caso em que há devolução. */
  if (assinatura.status === "cancelled" || assinatura.status === "paused") {
    const { error } = await admin
      .from("companies")
      .update({ plano_recorrente: false, mp_preapproval_id: null })
      .eq("id", pedido.company_id);
    if (error) {
      console.error("não consegui desligar a renovação:", error);
      return new Response("banco recusou", { status: 500 });
    }
    await admin.from("pedidos").update({ status: "cancelado" }).eq("id", idDoPedido);
    return ok("renovação desligada");
  }

  if (assinatura.status !== "authorized") return ok(`assinatura ${assinatura.status}`);

  const { data: empresa } = await admin
    .from("companies")
    .select("plano_ate")
    .eq("id", pedido.company_id)
    .maybeSingle();

  const { error } = await admin
    .from("companies")
    .update({
      plano: pedido.plano,
      plano_ate: novaValidade(empresa?.plano_ate, pedido.dias),
      plano_recorrente: true,
      plano_cortesia: false,
      mp_preapproval_id: idDaAssinatura,
    })
    .eq("id", pedido.company_id);

  if (error) {
    console.error("ASSINOU MAS NÃO LIGOU — pedido", idDoPedido, error);
    return new Response("não consegui ligar o plano", { status: 500 });
  }

  await admin
    .from("pedidos")
    .update({
      status: "pago",
      mp_preapproval_id: idDaAssinatura,
      pago_em: new Date().toISOString(),
    })
    .eq("id", idDoPedido);

  return ok("assinatura ligada");
}

/**
 * A mensalidade daquela assinatura foi cobrada — todo mês, sozinha.
 *
 * Aqui não há pedido novo: o que existe é uma empresa com o número da
 * assinatura guardado (0130), e o que se faz é empurrar a validade por
 * mais um mês.
 *
 * A busca é PELO NÚMERO DA ASSINATURA, e não pelo pedido: um ano depois,
 * o pedido original é história antiga, e a assinatura é o que continua
 * valendo.
 */
async function tratarMensalidade(admin: any, idDaCobranca: string): Promise<Response> {
  const resposta = await fetch(
    `https://api.mercadopago.com/authorized_payments/${idDaCobranca}`,
    { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
  );
  if (resposta.status === 404) return ok("cobrança não existe");
  if (!resposta.ok) {
    console.error("não consegui consultar a mensalidade:", resposta.status);
    return new Response("consulta falhou", { status: 500 });
  }

  const cobranca = await resposta.json().catch(() => null);
  if (!cobranca) return new Response("resposta ilegível", { status: 500 });

  /* O estado da cobrança vem em `payment.status` — `status` no primeiro
     nível é o da PROGRAMAÇÃO da mensalidade ("scheduled", "processed"), e
     confundir os dois ligaria o plano de quem teve o cartão recusado. */
  const situacao = cobranca?.payment?.status ?? "";
  if (situacao !== "approved") return ok(`mensalidade ${situacao || "sem estado"}`);

  const idDaAssinatura = String(cobranca.preapproval_id ?? "").trim();
  if (!idDaAssinatura) return ok("mensalidade sem assinatura");

  /* Mesma trava de repetição do pagamento avulso: o Mercado Pago reenvia,
     e sem isto o mês seria somado duas vezes. */
  const idDoPagamento = String(cobranca?.payment?.id ?? idDaCobranca);
  const { error: erroDaReserva } = await admin.from("processed_payments").insert({
    payment_id: idDoPagamento,
    valor_centavos: Math.round(Number(cobranca.transaction_amount ?? 0) * 100),
    tipo: "ei-assinatura",
  });
  if (erroDaReserva) {
    if ((erroDaReserva as any).code === "23505") return ok("mensalidade já processada");
    console.error("não consegui reservar a mensalidade:", erroDaReserva);
    return new Response("banco recusou a reserva", { status: 500 });
  }

  const { data: empresa, error: erroDaEmpresa } = await admin
    .from("companies")
    .select("id, plano_ate")
    .eq("mp_preapproval_id", idDaAssinatura)
    .maybeSingle();

  if (erroDaEmpresa) {
    await admin.from("processed_payments").delete().eq("payment_id", idDoPagamento);
    console.error("não consegui achar a empresa da assinatura:", erroDaEmpresa);
    return new Response("banco fora", { status: 500 });
  }
  if (!empresa) {
    console.error("mensalidade paga sem empresa correspondente:", idDaAssinatura);
    return ok("assinatura sem empresa");
  }

  const { error } = await admin
    .from("companies")
    .update({ plano_ate: novaValidade(empresa.plano_ate, 30), plano_recorrente: true })
    .eq("id", empresa.id);

  if (error) {
    await admin.from("processed_payments").delete().eq("payment_id", idDoPagamento);
    console.error("MENSALIDADE PAGA MAS NÃO RENOVOU —", idDaAssinatura, error);
    return new Response("não consegui renovar", { status: 500 });
  }

  return ok("mês somado");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MP_ACCESS_TOKEN) {
    console.error("webhook sem configuração: banco ou MP_ACCESS_TOKEN faltando");
    /* 500 aqui é o certo: falta configuração, e o reenvio do Mercado Pago
       vai encontrar a função já configurada. É a diferença entre perder um
       pagamento e atrasá-lo. */
    return new Response("sem configuração", { status: 500 });
  }

  let aviso: any = {};
  try {
    aviso = await req.json();
  } catch {
    return ok("corpo ilegível");
  }

  /* ── QUAL AVISO É ESTE ──────────────────────────────────────────────
     Três interessam, e cada um mexe numa coisa diferente:

       payment                          uma cobrança de uma vez só (0129)
       subscription_preapproval         a assinatura foi autorizada, ou
                                        cancelada (0130)
       subscription_authorized_payment  a mensalidade daquela assinatura
                                        foi cobrada

     Contestação, fraude e afins chegam no mesmo endereço e não têm o que
     fazer aqui. */
  const tipo = aviso?.type ?? aviso?.topic;
  const idDoAviso = String(aviso?.data?.id ?? aviso?.resource ?? "").trim();
  if (!idDoAviso) return ok("sem id");

  if (!(await assinaturaConfere(req, idDoAviso))) {
    console.error("assinatura do Mercado Pago não confere; aviso descartado");
    return new Response("assinatura inválida", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (tipo === "subscription_preapproval") {
    return await tratarAssinatura(admin, idDoAviso);
  }
  if (tipo === "subscription_authorized_payment") {
    return await tratarMensalidade(admin, idDoAviso);
  }
  if (tipo !== "payment") return ok("não é pagamento");

  const idDoPagamento = idDoAviso;

  /* ── O ESTADO REAL, PERGUNTADO NA FONTE ───────────────────────────── */
  const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${idDoPagamento}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });

  if (resposta.status === 404) return ok("pagamento não existe");
  if (!resposta.ok) {
    console.error("não consegui consultar o pagamento:", resposta.status);
    return new Response("consulta falhou", { status: 500 });
  }

  const pagamento = await resposta.json().catch(() => null);
  if (!pagamento) return new Response("resposta ilegível", { status: 500 });

  if (pagamento.status !== "approved") {
    /* Recusado, pendente, estornado. Não é erro: o Mercado Pago avisa a
       cada mudança, e o aviso do boleto que ainda não foi pago chega aqui
       exatamente assim. */
    return ok(`pagamento ${pagamento.status}`);
  }

  const valorCentavos = Math.round(Number(pagamento.transaction_amount ?? 0) * 100);

  /* ── UMA VEZ SÓ ─────────────────────────────────────────────────────
     O Mercado Pago manda mais de um aviso para o mesmo pagamento
     (`payment.created`, `payment.updated`, mais os reenvios). A
     `processed_payments` (0021) é a trava: quem consegue inserir o id é
     quem aplica o efeito; o segundo aviso esbarra na chave primária e vai
     embora sem fazer nada.

     A reserva vem ANTES do efeito de propósito. Ao contrário, dois avisos
     chegando juntos ligariam o plano duas vezes. */
  const { error: erroDaReserva } = await admin
    .from("processed_payments")
    .insert({ payment_id: idDoPagamento, valor_centavos: valorCentavos, tipo: "ei" });

  if (erroDaReserva) {
    /* 23505 = chave duplicada: já foi processado. Qualquer outro erro é
       banco com problema, e aí vale o reenvio. */
    if ((erroDaReserva as any).code === "23505") return ok("já processado");
    console.error("não consegui reservar o pagamento:", erroDaReserva);
    return new Response("banco recusou a reserva", { status: 500 });
  }

  /* ── O QUE ESSE DINHEIRO COMPROU ────────────────────────────────────
     `external_reference` é o id do pedido, gravado pela `criar-pagamento`
     antes de a pessoa ver a tela do Mercado Pago. */
  const idDoPedido = String(pagamento.external_reference ?? "").trim();
  if (!idDoPedido) {
    console.error("pagamento aprovado sem external_reference:", idDoPagamento);
    return ok("sem pedido");
  }

  const { data: pedido, error: erroDoPedido } = await admin
    .from("pedidos")
    .select("id, tipo, plano, company_id, professional_id, dias, status")
    .eq("id", idDoPedido)
    .maybeSingle();

  if (erroDoPedido) {
    /* Desfaz a reserva: sem ela, o reenvio do Mercado Pago acharia que já
       tinha sido processado e o plano nunca seria ligado. É o mesmo
       cuidado que a 0021 descreve. */
    await admin.from("processed_payments").delete().eq("payment_id", idDoPagamento);
    console.error("não consegui ler o pedido:", erroDoPedido);
    return new Response("banco fora", { status: 500 });
  }

  if (!pedido) {
    console.error("pagamento aprovado para um pedido que não existe:", idDoPedido);
    return ok("pedido não existe");
  }
  if (pedido.status === "pago") return ok("pedido já estava pago");

  /* ── LIGA O QUE FOI COMPRADO ───────────────────────────────────────
     `novaValidade` explica por que a conta é "de agora ou do que resta, o
     que for maior" — e é a mesma usada pela assinatura mensal, para as
     duas nunca divergirem. */
  let erroAoLigar: any = null;

  if (pedido.tipo === "plano_empresa" && pedido.company_id && pedido.plano) {
    const { data: empresa } = await admin
      .from("companies")
      .select("plano_ate")
      .eq("id", pedido.company_id)
      .maybeSingle();

    const { error } = await admin
      .from("companies")
      .update({
        plano: pedido.plano,
        plano_ate: novaValidade(empresa?.plano_ate, pedido.dias),
        plano_cortesia: false,
      })
      .eq("id", pedido.company_id);
    erroAoLigar = error;
  } else if (pedido.tipo === "destaque_profissional" && pedido.professional_id) {
    const { data: cadastro } = await admin
      .from("professionals")
      .select("boosted_until")
      .eq("id", pedido.professional_id)
      .maybeSingle();

    const { error } = await admin
      .from("professionals")
      .update({ boosted: true, boosted_until: novaValidade(cadastro?.boosted_until, pedido.dias) })
      .eq("id", pedido.professional_id);
    erroAoLigar = error;
  } else {
    console.error("pedido sem destino:", pedido);
    return ok("pedido incompleto");
  }

  if (erroAoLigar) {
    /* O dinheiro entrou e o benefício não ligou: é o pior caso, e por isso
       a reserva é desfeita para o Mercado Pago tentar de novo. */
    await admin.from("processed_payments").delete().eq("payment_id", idDoPagamento);
    console.error("PAGO MAS NÃO LIGOU — pedido", idDoPedido, erroAoLigar);
    return new Response("não consegui ligar o benefício", { status: 500 });
  }

  await admin
    .from("pedidos")
    .update({ status: "pago", mp_payment_id: idDoPagamento, pago_em: new Date().toISOString() })
    .eq("id", idDoPedido);

  return ok("ligado");
});
