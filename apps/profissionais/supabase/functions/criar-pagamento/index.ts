// Edge Function: abre a tela de pagamento do Mercado Pago.
//
// A dona: "vamos configurar o mercado livre pro site."
//
// O que ela faz, em uma frase: recebe do app QUAL plano a empresa quer,
// decide sozinha quanto isso custa, grava o pedido e devolve o endereço da
// tela de pagamento.
//
// ── POR QUE ISTO NÃO PODE ACONTECER NO NAVEGADOR ───────────────────────
//
// Três coisas, e cada uma sozinha já bastaria:
//
//   1. O PREÇO. Ele sai de `_shared/precosDoEi.ts`, aqui dentro. O app
//      manda a chave do plano ('dez'), nunca o valor. Se o valor viesse na
//      requisição, trocar um número nela assinaria o Ei Máximo por um
//      centavo — e a tela continuaria mostrando R$ 129,90, então ninguém
//      veria nada de errado.
//   2. O TOKEN do Mercado Pago. Ele movimenta dinheiro da conta da dona.
//      Tudo que vai para o navegador, qualquer um baixa.
//   3. O DONO. Quem paga tem de ser o dono da empresa (ou do cadastro) que
//      vai receber o benefício. Isso se confere no banco, contra o usuário
//      do token — não contra um id que veio na requisição.
//
// ── O PEDIDO NASCE ANTES DO PAGAMENTO ──────────────────────────────────
//
// A linha em `pedidos` (0129) é criada aqui, com status 'aberto', ANTES de
// mandar a pessoa para o Mercado Pago. O id dela vai como
// `external_reference`, e é por ele que o webhook, lá na frente, sabe o
// que aquele dinheiro comprou.
//
// A maioria dessas linhas vai morrer em 'aberto' — gente que vê a tela do
// Mercado Pago e desiste. Isso é o funil, não defeito.
//
// ── O VALOR FICA GRAVADO NO PEDIDO ─────────────────────────────────────
//
// E não é consultado de novo na hora de aplicar. Quem pagou R$ 89,90 pagou
// R$ 89,90: se o preço subir amanhã e o webhook for reler a tabela, um
// pagamento que estava a caminho vira outro valor no meio do caminho.
//
// Deploy: entra no DO_EI de `.github/workflows/publicar-functions.yml`.
// Sem isso ela não sobe, e o app recebe 404 sem nada explicando.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comCors } from "../_shared/cors.ts";
import { DESTAQUE, DIAS_DO_PLANO, PLANOS, ehPlanoCobravel } from "../_shared/precosDoEi.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

/**
 * Para onde o Mercado Pago manda a pessoa depois de pagar, e para onde ele
 * manda a notificação.
 *
 * Vem de um segredo e não de um endereço escrito aqui porque o site tem
 * dois endereços (o domínio e o da Vercel), e mandar a pessoa de volta
 * para o errado é sair da conta no meio do caminho.
 */
const SITE = (Deno.env.get("SITE_URL") ?? "https://www.empregoitabirito.com.br").replace(/\/$/, "");
const URL_DO_AVISO = `${SUPABASE_URL}/functions/v1/retorno-do-pagamento`;

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
  /* Sem token do Mercado Pago não dá para criar cobrança nenhuma. A
     mensagem é clara de propósito: este é o erro que vai aparecer enquanto
     o segredo não estiver no painel, e "algo deu errado" mandaria procurar
     defeito no lugar errado por horas. */
  if (!MP_ACCESS_TOKEN) {
    return erro("A cobrança ainda não está ligada (falta MP_ACCESS_TOKEN).", 503);
  }

  /* Quem está pedindo. O token vem do app; o usuário sai do token, nunca
     de um campo da requisição. */
  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao.startsWith("Bearer ")) return erro("Entre na sua conta.", 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: dadosDoUsuario, error: erroDoUsuario } = await admin.auth.getUser(
    autorizacao.replace("Bearer ", "")
  );
  const usuario = dadosDoUsuario?.user;
  if (erroDoUsuario || !usuario) return erro("Entre na sua conta.", 401);

  let corpo: any = {};
  try {
    corpo = await req.json();
  } catch {
    return erro("Pedido malformado.", 400);
  }

  const tipo = String(corpo?.tipo ?? "");
  if (tipo !== "plano_empresa" && tipo !== "destaque_profissional") {
    return erro("Não sei o que você quer comprar.", 400);
  }

  /* ── O que está sendo comprado, e por quanto ───────────────────────
     Repare que `centavos` e `dias` NUNCA saem de `corpo`. */
  let nome = "";
  let centavos = 0;
  let dias = 0;
  let plano: string | null = null;
  let companyId: string | null = null;
  let professionalId: string | null = null;

  if (tipo === "plano_empresa") {
    plano = String(corpo?.plano ?? "");
    if (!ehPlanoCobravel(plano)) {
      /* O 'ilimitado' cai aqui, e é o certo: ele é sob consulta, combinado
         caso a caso. Cobrar um valor inventado por ele seria pior do que
         não vender. */
      return erro("Este plano não é vendido pelo site.", 400);
    }
    nome = `${PLANOS[plano].nome} — ${DIAS_DO_PLANO} dias`;
    centavos = PLANOS[plano].centavos;
    dias = DIAS_DO_PLANO;

    /* A empresa é procurada PELO DONO, e não pelo id que veio na
       requisição. É esta linha que impede alguém de pagar um centavo e
       ligar o plano na empresa de outra pessoa — ou de descobrir, pelo
       erro, quais ids de empresa existem. */
    const { data: empresa, error: erroDaEmpresa } = await admin
      .from("companies")
      .select("id")
      .eq("owner_id", usuario.id)
      .limit(1)
      .maybeSingle();
    if (erroDaEmpresa) return erro("Não consegui ler sua empresa.", 500);
    if (!empresa) return erro("Cadastre sua empresa antes de assinar.", 400);
    companyId = empresa.id;
  } else {
    nome = DESTAQUE.nome;
    centavos = DESTAQUE.centavos;
    dias = DESTAQUE.dias;

    const { data: cadastro, error: erroDoCadastro } = await admin
      .from("professionals")
      .select("id")
      .eq("owner_id", usuario.id)
      .limit(1)
      .maybeSingle();
    if (erroDoCadastro) return erro("Não consegui ler seu cadastro.", 500);
    if (!cadastro) return erro("Faça seu cadastro antes de destacar.", 400);
    professionalId = cadastro.id;
  }

  /* ── O pedido, antes de qualquer dinheiro ──────────────────────────── */
  const { data: pedido, error: erroDoPedido } = await admin
    .from("pedidos")
    .insert({
      user_id: usuario.id,
      tipo,
      plano,
      company_id: companyId,
      professional_id: professionalId,
      dias,
      centavos,
    })
    .select("id")
    .single();

  /* Erro SOBE. Um pedido que "deu certo" sem ter sido gravado é o pior
     caso possível: a pessoa paga e não existe nada no banco dizendo o que
     aquele dinheiro comprou. */
  if (erroDoPedido || !pedido) {
    console.error("não gravei o pedido:", erroDoPedido);
    return erro("Não consegui abrir o pagamento. Tente de novo.", 500);
  }

  /* ── A tela de pagamento ────────────────────────────────────────────
     `purpose` fica de FORA de propósito. Com `purpose: "wallet_purchase"`
     o Mercado Pago exige que quem paga esteja logado na conta dele — e a
     dona perguntou justamente por quem NÃO tem Mercado Pago. Sem ele,
     paga-se como convidado: Pix, boleto ou cartão digitado na hora. */
  const preferencia = {
    items: [
      {
        id: pedido.id,
        title: nome,
        quantity: 1,
        currency_id: "BRL",
        unit_price: centavos / 100,
      },
    ],
    /* É por aqui que o webhook descobre o que foi comprado. Sem isso, a
       notificação chega dizendo só "o pagamento X foi aprovado" e não há
       como saber de quem nem de quê. */
    external_reference: pedido.id,
    notification_url: URL_DO_AVISO,
    back_urls: {
      success: `${SITE}/pagamento-ok?pedido=${pedido.id}`,
      pending: `${SITE}/pagamento-ok?pedido=${pedido.id}`,
      failure: `${SITE}/pagamento-nao?pedido=${pedido.id}`,
    },
    auto_return: "approved",
    payer: { email: usuario.email ?? undefined },
    statement_descriptor: "EI EMPREGO",
  };

  const resposta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      /* O Mercado Pago reenvia requisição sozinho quando a resposta demora.
         Sem esta chave, o mesmo toque no botão viraria duas telas de
         pagamento — e às vezes duas cobranças. */
      "X-Idempotency-Key": pedido.id,
    },
    body: JSON.stringify(preferencia),
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok || !dados?.init_point) {
    /* O pedido fica marcado como cancelado: ele nunca chegou a virar uma
       tela de pagamento, e deixá-lo 'aberto' encheria o painel de linhas
       que parecem gente que desistiu — quando na verdade é defeito nosso. */
    await admin.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
    console.error("Mercado Pago recusou a preferência:", resposta.status, dados);
    return erro("O Mercado Pago não abriu o pagamento. Tente de novo.", 502);
  }

  await admin
    .from("pedidos")
    .update({ mp_preference_id: String(dados.id ?? "") })
    .eq("id", pedido.id);

  return new Response(
    JSON.stringify({ pedidoId: pedido.id, url: dados.init_point }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}));
