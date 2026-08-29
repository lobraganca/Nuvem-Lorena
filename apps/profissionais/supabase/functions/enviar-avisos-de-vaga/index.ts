// Edge Function: manda as notificações push das vagas que ainda não saíram.
//
// Lê a fila em `job_notifications` (linhas com `enviado_em` nulo), manda o
// aviso para cada aparelho da pessoa e marca a data. Roda por chamada — do
// app, logo depois de a onda abrir — e também pode ser chamada por rotina,
// para pegar o que ficou para trás.
//
// POR QUE UMA FILA, E NÃO MANDAR NA HORA DO DISPARO
//
// Uma onda pode alcançar dezenas de pessoas, cada uma com vários aparelhos.
// Mandar tudo dentro da chamada que cria a vaga faria a empresa esperar o
// tempo de todos os envios — e um erro no meio deixaria metade avisada, sem
// registro de qual metade. Com a fila, quem não saiu continua na fila.
//
// Variáveis de ambiente exigidas:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   FCM_SERVER_KEY     — chave do Firebase, para o app da Play Store
//   VAPID_PUBLICA      — o par da que está no app (VITE_VAPID_PUBLICA)
//   VAPID_PRIVADA      — a que assina o envio. NUNCA vai para o app.
//   VAPID_SUBJECT      — "mailto:algo@dominio", exigido pelo Web Push
//
// Deploy: supabase functions deploy enviar-avisos-de-vaga

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY") ?? "";
const VAPID_PUBLICA = Deno.env.get("VAPID_PUBLICA") ?? "";
const VAPID_PRIVADA = Deno.env.get("VAPID_PRIVADA") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";

/* Teto por chamada. Sem ele, uma onda grande estouraria o tempo da função e
   ela morreria no meio — deixando parte da fila enviada e parte não, sem
   nada dizendo onde parou. Com teto, o resto fica na fila para a chamada
   seguinte, que é exatamente o que a fila existe para permitir. */
const POR_VEZ = 200;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

if (VAPID_PUBLICA && VAPID_PRIVADA && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLICA, VAPID_PRIVADA);
}

/** Manda para um aparelho. Devolve `false` quando o aparelho não vale mais. */
async function mandar(
  aparelho: any,
  aviso: { titulo: string; corpo: string; url: string; tag: string }
): Promise<{ entregue: boolean; sumiu: boolean }> {
  // ── App da Play Store: Firebase ──────────────────────────────────────
  if (aparelho.token) {
    if (!FCM_SERVER_KEY) return { entregue: false, sumiu: false };

    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: aparelho.token,
        notification: { title: aviso.titulo, body: aviso.corpo },
        // O `data` é o que o app lê ao ser aberto pelo toque.
        data: { url: aviso.url },
        // Agrupa por vaga: dois avisos da mesma vaga viram um. Quem recebe
        // três notificações da mesma coisa desliga o aviso — e aí perde a
        // próxima, que era a que importava.
        android: { collapse_key: aviso.tag },
      }),
    });

    const corpo = await r.json().catch(() => ({}));
    /* Token inválido significa app desinstalado, ou reinstalado com token
       novo. O aparelho sai da tabela: insistir nele é gastar tentativa a
       cada onda, para sempre. */
    const sumiu =
      corpo?.results?.[0]?.error === "NotRegistered" ||
      corpo?.results?.[0]?.error === "InvalidRegistration";
    return { entregue: r.ok && corpo?.success === 1, sumiu };
  }

  // ── Site: Web Push ───────────────────────────────────────────────────
  if (aparelho.endpoint) {
    if (!VAPID_PRIVADA) return { entregue: false, sumiu: false };

    try {
      await webpush.sendNotification(
        {
          endpoint: aparelho.endpoint,
          keys: { p256dh: aparelho.p256dh, auth: aparelho.auth },
        },
        JSON.stringify(aviso)
      );
      return { entregue: true, sumiu: false };
    } catch (e: any) {
      /* 404 e 410 são o navegador dizendo que a inscrição morreu — a pessoa
         limpou os dados do site, ou desinstalou o app. Some da tabela pelo
         mesmo motivo do token. */
      const sumiu = e?.statusCode === 404 || e?.statusCode === 410;
      return { entregue: false, sumiu };
    }
  }

  return { entregue: false, sumiu: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  /* A fila: avisos criados e ainda não enviados, com a vaga e a empresa
     junto — é o que compõe o texto da notificação. Vaga fechada fica de
     fora: avisar de uma vaga que já encheu é o pior aviso possível, porque
     a pessoa se anima e não recebe resposta. */
  const { data: fila, error } = await sb
    .from("job_notifications")
    .select(
      `id, professional_id, job_listing_id,
       job_listings!inner ( id, title, profession, status, companies!inner ( company_name ) )`
    )
    .is("enviado_em", null)
    .eq("job_listings.status", "active")
    .limit(POR_VEZ);

  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let enviados = 0;
  let semAparelho = 0;

  for (const linha of fila ?? []) {
    const vaga: any = (linha as any).job_listings;

    const { data: aparelhos } = await sb
      .from("push_devices")
      .select("*")
      .eq("user_id", (linha as any).professional_id);

    /* Sem aparelho, a linha é marcada como enviada do mesmo jeito.
       ────────────────────────────────────────────────────────────
       Parece errado e é o certo: a fila é de ENVIO, e não há o que enviar
       para quem não tem aparelho. Deixar a linha ali faria ela ser
       reprocessada a cada chamada, para sempre, sem chance de mudar de
       resultado — e a fila cresceria até engolir as que têm conserto.

       A pessoa não fica sem o recado: a vaga continua em
       `job_notifications` e aparece em "vagas para você" quando ela abrir o
       app. O push é o empurrão, não o único caminho. */
    if (!aparelhos || aparelhos.length === 0) {
      await sb
        .from("job_notifications")
        .update({ enviado_em: new Date().toISOString() })
        .eq("id", (linha as any).id);
      semAparelho++;
      continue;
    }

    const aviso = {
      titulo: `Vaga de ${vaga.profession} em Itabirito`,
      corpo: `${vaga.companies?.company_name ?? "Uma empresa"} está procurando. Toque para ver.`,
      url: "/vagas-para-mim",
      tag: `vaga-${vaga.id}`,
    };

    let algumEntregou = false;
    for (const aparelho of aparelhos) {
      const { entregue, sumiu } = await mandar(aparelho, aviso);
      if (entregue) algumEntregou = true;
      if (sumiu) await sb.from("push_devices").delete().eq("id", aparelho.id);
    }

    /* Só marca como enviado se algum aparelho aceitou. Um erro passageiro
       do Firebase deixa a linha na fila para a próxima chamada — que é
       justamente o que a fila serve para resolver. */
    if (algumEntregou) {
      await sb
        .from("job_notifications")
        .update({ enviado_em: new Date().toISOString() })
        .eq("id", (linha as any).id);
      enviados++;
    }
  }

  return new Response(
    JSON.stringify({ enviados, semAparelho, naFila: (fila ?? []).length }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});
