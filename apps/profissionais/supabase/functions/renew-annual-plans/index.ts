// Edge Function AGENDADA (roda 1x/dia via pg_cron — ver README, seção
// "Fontes de renda"). Faz as duas tarefas periódicas do app:
//
//   1. RENOVAÇÃO DO PLANO ANUAL À VISTA (Pix/boleto). Pix e boleto não têm
//      débito automático na API do Mercado Pago, então "recorrente" aqui
//      significa: quando o plano está perto de vencer, o sistema já gera a
//      nova cobrança e manda o link por e-mail ao dono do anúncio — ele não
//      precisa lembrar de nada nem procurar nada no app. Quem paga no
//      cartão (mensal ou anual via preapproval, `auto_renew = true`) NÃO
//      entra aqui: o Mercado Pago cobra sozinho.
//
//   2. EXPIRAÇÃO DOS PATROCÍNIOS DE CATEGORIA: marca
//      `category_sponsorships.status = 'expired'` onde `ends_at < now()` e
//      o status ainda é 'active'. (A leitura pública já filtra por
//      `ends_at > now()`, então isso é higiene de dados/painel, não uma
//      brecha — mas era um TODO conhecido do README.)
//
// Quem pode chamar: só quem apresenta a `service_role` key no header
// `Authorization` (é o que o pg_cron manda). Nenhum usuário final chama esta
// function.
//
// Variáveis de ambiente exigidas (configure com `supabase secrets set`):
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL
//   RESEND_API_KEY    — mesmo padrão de `notify-suspension`. Sem ela, a
//                       function NÃO quebra: loga o aviso, pula os e-mails
//                       (sem marcar ninguém como avisado, para o aviso sair
//                       quando a chave for configurada) e ainda assim
//                       expira os patrocínios vencidos.
//   RESEND_FROM_EMAIL — remetente verificado na Resend.
//
// Deploy: supabase functions deploy renew-annual-plans

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ehTipoValido, precoAnual, precoMensal, ROTULOS, type TipoDePessoa } from "../_shared/precos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "procurô <avisos@DOMINIO-AINDA-NAO-DEFINIDO>";

/** Quantos dias antes do vencimento o aviso de renovação é disparado. */
const NOTICE_WINDOW_DAYS = 7;
/**
 * Janela de tolerância para trás: um plano que venceu há mais de 7 dias já é
 * considerado abandonado — não faz sentido cobrar renovação de um benefício
 * que caiu faz tempo (o dono pode simplesmente assinar de novo no painel).
 */
const GRACE_DAYS = 7;


function formatBRL(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Cria a preferência de pagamento da renovação — mesma lógica (e mesmo
 * `external_reference`) de `mercadopago-create-annual-payment`, para o
 * webhook confirmar a renovação exatamente como confirma uma compra nova.
 */
async function createRenewalPreference(
  professionalId: string,
  professionalName: string,
  type: string,
  pessoa: TipoDePessoa,
  ownerEmail: string,
  ciclo: "annual" | "monthly"
): Promise<string | null> {
  const anual = ciclo === "annual";
  const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: anual
            ? `procurô — ${ROTULOS[type]} (${professionalName}) — renovação do plano anual, com 20% de desconto`
            : `procurô — ${ROTULOS[type]} (${professionalName}) — renovação de mais 1 mês`,
          quantity: 1,
          unit_price: anual ? precoAnual(type, pessoa) : precoMensal(type, pessoa),
          currency_id: "BRL",
        },
      ],
      back_urls: {
        success: `${PUBLIC_APP_URL}/painel`,
        failure: `${PUBLIC_APP_URL}/painel`,
        pending: `${PUBLIC_APP_URL}/painel`,
      },
      auto_return: "approved",
      external_reference: `${anual ? "annual" : "mensal"}:${professionalId}:${type}`,
      payer: { email: ownerEmail },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("renew-annual-plans: falha ao criar preferência no Mercado Pago", professionalId, type, data);
    return null;
  }
  return data.init_point ?? null;
}

async function sendRenewalEmail(
  ownerEmail: string,
  professionalName: string,
  type: string,
  pessoa: TipoDePessoa,
  expiresAt: string,
  initPoint: string
): Promise<boolean> {
  const price = formatBRL(precoAnual(type, pessoa));
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: ownerEmail,
      subject: `Seu plano anual (${ROTULOS[type]}) vence em ${formatDate(expiresAt)}`,
      text:
        `Olá,\n\n` +
        `O plano anual de "${ROTULOS[type]}" do seu anúncio "${professionalName}" no procurô ` +
        `vence em ${formatDate(expiresAt)}.\n\n` +
        `Como você pagou no Pix/boleto (pagamento único), a renovação não é automática — mas já deixamos ` +
        `a cobrança pronta para você. Basta pagar por este link:\n\n${initPoint}\n\n` +
        `Valor: R$ ${price} pelo ano inteiro (20% de desconto sobre o mensal). Aceita Pix, cartão ou boleto.\n\n` +
        `Se preferir não ter que pagar manualmente todo ano, no painel do app você pode trocar para o plano ` +
        `anual no cartão, que renova sozinho.\n\n` +
        `Se você não quiser renovar, é só ignorar este e-mail — o benefício simplesmente deixa de valer no ` +
        `vencimento, sem cobrança nenhuma.\n\n` +
        `Equipe procurô`,
    }),
  });

  if (!resp.ok) {
    console.error("renew-annual-plans: falha ao enviar e-mail via Resend", resp.status, await resp.text());
    return false;
  }
  return true;
}

/** Frente 3: marca como 'expired' os patrocínios de categoria já vencidos. */
async function expireSponsorships(admin: ReturnType<typeof createClient>): Promise<number> {
  const { data, error } = await admin
    .from("category_sponsorships")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("renew-annual-plans: falha ao expirar patrocínios", error);
    return 0;
  }
  return data?.length ?? 0;
}

Deno.serve(async (req) => {
  // Só o cron (service_role key) pode disparar esta rotina.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!SUPABASE_SERVICE_ROLE_KEY || token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Acesso restrito." }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();

  const expiredSponsorships = await expireSponsorships(admin);

  if (!MP_ACCESS_TOKEN) {
    console.warn("renew-annual-plans: MP_ACCESS_TOKEN não configurado — pulando avisos de renovação.");
    return new Response(JSON.stringify({ expiredSponsorships, notified: 0, reason: "MP_ACCESS_TOKEN ausente." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    // Falha graciosa (mesmo padrão de notify-suspension): não marca ninguém
    // como avisado, então o aviso sai assim que a chave for configurada.
    console.warn("renew-annual-plans: RESEND_API_KEY não configurada — pulando avisos de renovação.");
    return new Response(JSON.stringify({ expiredSponsorships, notified: 0, reason: "RESEND_API_KEY ausente." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Candidatos: planos ANUAIS que NÃO renovam sozinhos (pagos à vista no
  // Pix/boleto), ativos e ainda sem aviso enviado neste ciclo.
  const { data: candidates, error } = await admin
    .from("subscriptions")
    .select(
      "id, professional_id, type, billing_cycle, current_period_end, professionals!inner(id, name, owner_id, entity_type, verified_until, boosted_until, plus_until)"
    )
    /* Mensal à vista entra aqui pelo mesmo motivo do anual: Pix e boleto não
       renovam sozinhos, então quem avisa é o app. Sem isso, quem paga por
       Pix perde o benefício em silêncio e só descobre quando o cliente
       reclama que o WhatsApp sumiu. */
    .in("billing_cycle", ["annual", "monthly"])
    .eq("auto_renew", false)
    .eq("status", "active")
    .is("renewal_notified_at", null);

  if (error) {
    console.error("renew-annual-plans: falha ao buscar assinaturas anuais", error);
    return new Response(JSON.stringify({ expiredSponsorships, notified: 0, error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const windowEnd = new Date(now.getTime() + NOTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const graceStart = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  let notified = 0;

  for (const row of candidates ?? []) {
    const professional: any = Array.isArray((row as any).professionals)
      ? (row as any).professionals[0]
      : (row as any).professionals;
    if (!professional) continue;

    const type = String((row as any).type);
    if (!ehTipoValido(type)) continue;
    // O preço da conta premium depende de ser pessoa ou empresa; a renovação
    // tem que cobrar o mesmo que a assinatura original cobrou.
    const pessoa: TipoDePessoa = professional.entity_type === "pj" ? "pj" : "pf";

    // A validade que vale é a do próprio benefício em `professionals`
    // (é ela que o app checa para mostrar selo/destaque/Plus);
    // `current_period_end` é só o espelho na assinatura.
    const untilRaw = professional[UNTIL_FIELD[type]] ?? (row as any).current_period_end;
    if (!untilRaw) continue;
    const until = new Date(untilRaw);
    if (until > windowEnd || until < graceStart) continue;

    const { data: ownerUser, error: ownerError } = await admin.auth.admin.getUserById(professional.owner_id);
    const ownerEmail = ownerUser?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("renew-annual-plans: dono sem e-mail cadastrado", professional.id, ownerError);
      continue;
    }

    const ciclo = (row as any).billing_cycle === "monthly" ? "monthly" : "annual";
    const initPoint = await createRenewalPreference(
      professional.id,
      professional.name,
      type,
      pessoa,
      ownerEmail,
      ciclo
    );
    if (!initPoint) continue;

    const sent = await sendRenewalEmail(ownerEmail, professional.name, type, pessoa, until.toISOString(), initPoint);
    if (!sent) continue;

    // Só marca depois do e-mail sair de verdade — se falhar, o cron tenta de
    // novo amanhã em vez de deixar o dono sem aviso nenhum.
    await admin
      .from("subscriptions")
      .update({ renewal_notified_at: new Date().toISOString() })
      .eq("id", (row as any).id);
    notified += 1;
  }

  return new Response(JSON.stringify({ expiredSponsorships, notified }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
