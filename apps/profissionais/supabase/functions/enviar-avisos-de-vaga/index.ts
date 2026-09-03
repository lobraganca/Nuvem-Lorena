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
//   FCM_SERVICE_ACCOUNT — o JSON da conta de serviço do Firebase, para o
//                         app da Play Store. Ver `_shared/fcm.ts`.
//   VAPID_PUBLICA      — o par da que está no app (VITE_VAPID_PUBLICA)
//   VAPID_PRIVADA      — a que assina o envio. NUNCA vai para o app.
//   VAPID_SUBJECT      — "mailto:algo@dominio", exigido pelo Web Push
//
// A antiga `FCM_SERVER_KEY` não é mais usada: o Google desligou a API que a
// aceitava em junho de 2024. Pode ser apagada do painel.
//
// Deploy: supabase functions deploy enviar-avisos-de-vaga

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { fcmConfigurado, mandarPeloFirebase } from "../_shared/fcm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
    return await mandarPeloFirebase(aparelho.token, aviso);
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

  /* Os aparelhos de TODA a leva, numa consulta só.
     ──────────────────────────────────────────────
     Era uma consulta por linha da fila: com o teto de 200, até 200 idas ao
     banco por chamada, em série. Numa onda grande isso sozinho consumia o
     tempo da função — e a função morrer no meio é o que deixa metade da
     fila sem sair. Uma consulta com `in` traz tudo e o laço só distribui. */
  const contas = [...new Set((fila ?? []).map((l: any) => l.professional_id))];
  const { data: todosAparelhos } = await sb
    .from("push_devices")
    .select("*")
    .in("user_id", contas);

  const aparelhosPorConta = new Map<string, any[]>();
  for (const a of todosAparelhos ?? []) {
    const lista = aparelhosPorConta.get((a as any).user_id) ?? [];
    lista.push(a);
    aparelhosPorConta.set((a as any).user_id, lista);
  }

  for (const linha of fila ?? []) {
    const vaga: any = (linha as any).job_listings;
    const aparelhos = aparelhosPorConta.get((linha as any).professional_id) ?? [];

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

    /* ── O QUE O AVISO DIZ — 04/09 ──────────────────────────────────
       A dona: "o aviso que chega pro funcionário é que uma vaga foi
       publicada e que o perfil dele se adequa ao seu."

       Dizia "{Empresa} está procurando. Toque para ver." — verdade, mas
       sem a parte que faz a pessoa abrir: POR QUE este aviso chegou nela
       e não em todo mundo. A onda escolhe por ofício (ver `calcularOndas`),
       então "combina com o seu cadastro" não é elogio nem promessa de
       vaga: é a explicação do que aconteceu. */
    const aviso = {
      titulo: `Vaga nova de ${vaga.profession} em Itabirito`,
      corpo: `${vaga.companies?.company_name ?? "Uma empresa"} publicou uma vaga que combina com o seu cadastro. Toque para ver.`,
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

  /* A resposta DIZ quando um dos dois caminhos está desligado.
     ──────────────────────────────────────────────────────────
     Antes, sem a chave do Firebase, a função devolvia `enviados: 0` e nada
     mais — indistinguível de "não havia nada a enviar". É o número que
     mente calado: quem olhasse concluiria que a fila estava vazia, e não
     que o envio inteiro estava desligado por falta de configuração.

     `pendentes` existe pelo mesmo motivo: com o teto de 200 por chamada,
     uma onda maior deixa resto — e sem este número ninguém saberia que ele
     existe. */
  const { count: pendentes } = await sb
    .from("job_notifications")
    .select("id", { count: "exact", head: true })
    .is("enviado_em", null);

  return new Response(
    JSON.stringify({
      enviados,
      semAparelho,
      naFila: (fila ?? []).length,
      pendentes: pendentes ?? null,
      firebaseConfigurado: fcmConfigurado(),
      webPushConfigurado: Boolean(VAPID_PRIVADA && VAPID_PUBLICA && VAPID_SUBJECT),
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});
