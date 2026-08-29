import { supabase } from "./supabase";
import { ehAppDaLoja } from "./plataforma";
import { VAPID_PUBLICA } from "../config";

/**
 * O aviso de vaga, por notificação push.
 *
 * São dois caminhos porque são dois apps, e nenhum dos dois é opcional:
 *
 * - **App da Play Store**: Firebase. O Android entrega um `token`, e é para
 *   ele que o servidor manda. Chega com o app fechado, que é o que faz o
 *   aviso valer alguma coisa.
 * - **Site (PWA)**: Web Push. O navegador entrega um `endpoint` e duas
 *   chaves. Funciona no Android e no computador; no iPhone SÓ para quem
 *   adicionou o app à tela de início — em aba comum o Safari não recebe.
 *
 * O que isso custa, e precisa estar dito em algum lugar: **push só alcança
 * quem instalou e aceitou**. Não é como SMS, que chega em qualquer número.
 * Quem usa o app pelo navegador sem instalar não recebe nada, e nunca vai
 * saber que não recebeu. Por isso a vaga também fica registrada em
 * `job_notifications` e aparece em "vagas para você" quando a pessoa abre o
 * app: o push é o empurrão, não o único caminho.
 *
 * Nada aqui pede permissão sozinho. Pedir no primeiro segundo é o jeito
 * mais rápido de levar "não" para sempre — no iPhone e no Android a recusa
 * é definitiva, e não há segunda chance nem caixa de diálogo para reverter.
 * Quem chama `pedirPermissaoDePush` é a tela que já explicou para quê.
 */

/** O aparelho consegue receber aviso aqui? */
export function pushServeAqui(): boolean {
  if (ehAppDaLoja()) return true;
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/** Já foi decidido antes? "default" = ainda não perguntamos. */
export function situacaoDaPermissao(): NotificationPermission | "indisponivel" {
  if (!pushServeAqui()) return "indisponivel";
  if (ehAppDaLoja()) return "default";
  return Notification.permission;
}

/**
 * Converte a chave VAPID do formato que se guarda (base64url) para o que o
 * navegador exige (Uint8Array). Sem isto o `subscribe` recusa a chave sem
 * dizer o motivo.
 */
function chaveParaBytes(base64: string): BufferSource {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const cru = atob(preenchido);
  /* O buffer é criado explicitamente porque o `Uint8Array` do TypeScript 5.9
     pode estar apoiado num `SharedArrayBuffer`, e o `subscribe` só aceita
     `ArrayBuffer`. Sem isto os tipos recusam algo que funciona. */
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
}

/** Guarda o aparelho, ou atualiza o `visto_em` se ele já estava lá. */
async function guardarAparelho(dados: {
  plataforma: "android" | "ios" | "web";
  token?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;

  const { data: sessao } = await sb.auth.getUser();
  const userId = sessao.user?.id;
  /* Sem conta não há para quem mandar. Não é erro: a pessoa pode estar
     usando o app sem entrar, e a permissão que ela deu vale para quando
     entrar. */
  if (!userId) return;

  const { error } = await sb.from("push_devices").upsert(
    { ...dados, user_id: userId, visto_em: new Date().toISOString() },
    { onConflict: dados.token ? "token" : "endpoint" }
  );
  if (error) throw error;
}

/**
 * Pede a permissão e guarda o aparelho.
 *
 * Devolve `true` só quando o aparelho ficou de fato registrado. `false` é
 * "não vai receber" — e quem chamou precisa dizer isso na tela, porque uma
 * pessoa que acha que ativou e não ativou fica esperando um aviso que nunca
 * chega.
 */
export async function pedirPermissaoDePush(): Promise<boolean> {
  if (!pushServeAqui()) return false;

  if (ehAppDaLoja()) {
    /* No app da loja quem faz isto é o plugin do Capacitor, que fala com o
       Firebase. O import é dinâmico e dentro do `try` de propósito: o
       pacote do site não pode carregar biblioteca nativa, e num app antigo
       (instalado antes de o plugin existir) ele simplesmente não está lá —
       nos dois casos a resposta certa é "não dá", não uma tela quebrada. */
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permissao = await PushNotifications.requestPermissions();
      if (permissao.receive !== "granted") return false;

      /* O token não volta da chamada: ele chega depois, por evento. Sem
         esperar por ele, a função diria "deu certo" com o aparelho ainda
         não registrado. */
      const token = await new Promise<string | null>((resolve) => {
        const prazo = setTimeout(() => resolve(null), 10_000);
        PushNotifications.addListener("registration", (t) => {
          clearTimeout(prazo);
          resolve(t.value);
        });
        PushNotifications.addListener("registrationError", () => {
          clearTimeout(prazo);
          resolve(null);
        });
        PushNotifications.register();
      });

      if (!token) return false;
      await guardarAparelho({ plataforma: "android", token });
      return true;
    } catch {
      return false;
    }
  }

  /* Site. Sem a chave VAPID configurada não há como inscrever ninguém —
     e é melhor devolver `false` do que estourar: a tela que chamou sabe
     dizer "não deu" de um jeito que a pessoa entende. */
  if (!VAPID_PUBLICA) return false;

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return false;

  try {
    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.subscribe({
      // Sem isto o Chrome recusa a inscrição: ele exige que todo push seja
      // visível para a pessoa, justamente para ninguém usar push como
      // rastreador silencioso.
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(VAPID_PUBLICA),
    });

    const bruto = inscricao.toJSON();
    await guardarAparelho({
      plataforma: "web",
      endpoint: inscricao.endpoint,
      p256dh: bruto.keys?.p256dh,
      auth: bruto.keys?.auth,
    });
    return true;
  } catch {
    return false;
  }
}
