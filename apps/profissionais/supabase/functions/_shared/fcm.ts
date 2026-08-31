// Mandar notificação para o app da Play Store, pela API atual do Firebase.
//
// ── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────
//
// O envio usava `https://fcm.googleapis.com/fcm/send` com o cabeçalho
// `Authorization: key=<FCM_SERVER_KEY>`. Essa é a API ANTIGA do Firebase, e
// o Google a DESLIGOU em 20 de junho de 2024. Ela não está lenta nem
// depreciada: ela não existe mais. Toda chamada volta erro, sempre.
//
// O efeito era o pior tipo: silencioso e invisível dos dois lados. A função
// contava o envio como "não entregue", a linha ficava na fila, ninguém era
// avisado, e nenhuma tela do app mostrava nada de diferente. A empresa via
// "12 pessoas alcançadas" e as 12 pessoas não recebiam nada.
//
// A API atual é a HTTP v1. Ela muda três coisas:
//
//   1. O endereço leva o id do projeto.
//   2. A autenticação é OAuth2 (`Bearer`), e não uma chave fixa. O token
//      dura uma hora e é assinado com a chave de uma conta de serviço.
//   3. O corpo é outro, e os erros também: some o `results[0].error` e
//      entram códigos HTTP com um `error.status` em texto.
//
// ── O QUE PRECISA ESTAR CONFIGURADO ──────────────────────────────────────
//
//   FCM_SERVICE_ACCOUNT — o JSON inteiro da conta de serviço, numa linha.
//     Firebase > Configurações do projeto > Contas de serviço >
//     "Gerar nova chave privada". É um segredo: dá para mandar notificação
//     para qualquer aparelho do projeto. Nunca vai para o app.
//
// A `FCM_SERVER_KEY` antiga pode ser apagada — ela não serve para nada.

// deno-lint-ignore-file no-explicit-any

type ContaDeServico = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function lerConta(): ContaDeServico | null {
  const bruto = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto);
    if (!c.project_id || !c.client_email || !c.private_key) return null;
    return c;
  } catch {
    /* JSON quebrado ao colar no painel — acontece, e o efeito de ignorar
       seria de novo "não manda e não diz por quê". Quem chama trata o
       `null` dizendo o motivo na resposta. */
    return null;
  }
}

/** O PEM da conta de serviço vira uma chave que o Web Crypto assina. */
async function importarChave(pem: string): Promise<CryptoKey> {
  const corpo = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    /* As quebras de linha chegam escapadas quando o JSON é colado como
       variável de ambiente. Sem desfazer isso, o `atob` engasga num "\" e
       a mensagem de erro não menciona a causa. */
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

const base64url = (dados: Uint8Array | string): string => {
  const bin = typeof dados === "string" ? dados : String.fromCharCode(...dados);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/* O token vale uma hora; guardá-lo evita uma ida ao Google por notificação.
   Numa onda de 200 pessoas isso é a diferença entre 1 e 200 chamadas a
   mais — e a função tem tempo contado. */
let tokenEmCache: { valor: string; expiraEm: number } | null = null;

async function obterToken(conta: ContaDeServico): Promise<string | null> {
  const agora = Math.floor(Date.now() / 1000);
  /* 60 segundos de folga: um token que expira no meio do envio derruba o
     resto da leva, e renovar cedo não custa nada. */
  if (tokenEmCache && tokenEmCache.expiraEm > agora + 60) return tokenEmCache.valor;

  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    })
  );

  const chave = await importarChave(conta.private_key);
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      chave,
      new TextEncoder().encode(`${cabecalho}.${corpo}`)
    )
  );

  const jwt = `${cabecalho}.${corpo}.${base64url(assinatura)}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!r.ok) return null;
  const dados = await r.json().catch(() => null);
  if (!dados?.access_token) return null;

  tokenEmCache = { valor: dados.access_token, expiraEm: agora + (dados.expires_in ?? 3600) };
  return dados.access_token;
}

export type Aviso = { titulo: string; corpo: string; url: string; tag: string };
export type Resultado = { entregue: boolean; sumiu: boolean; motivo?: string };

/** O Firebase está configurado nesta função? */
export function fcmConfigurado(): boolean {
  return lerConta() !== null;
}

/**
 * Manda para UM aparelho pelo token do Firebase.
 *
 * `sumiu: true` quer dizer que o token não vale mais — app desinstalado, ou
 * reinstalado com token novo. Quem chama apaga o aparelho: insistir nele é
 * gastar uma tentativa a cada onda, para sempre.
 */
export async function mandarPeloFirebase(token: string, aviso: Aviso): Promise<Resultado> {
  const conta = lerConta();
  if (!conta) return { entregue: false, sumiu: false, motivo: "FCM_SERVICE_ACCOUNT ausente ou inválida" };

  const acesso = await obterToken(conta);
  if (!acesso) return { entregue: false, sumiu: false, motivo: "não consegui o token do Google" };

  const r = await fetch(
    `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acesso}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: aviso.titulo, body: aviso.corpo },
          // O que o app lê ao ser aberto pelo toque. Na v1 todo valor de
          // `data` é texto — número aqui é recusado com erro de tipo.
          data: { url: aviso.url },
          android: {
            // Agrupa por vaga: dois avisos da mesma vaga viram um. Quem
            // recebe três notificações da mesma coisa desliga o aviso — e
            // aí perde a próxima, que era a que importava.
            collapse_key: aviso.tag,
            priority: "high",
            notification: { tag: aviso.tag },
          },
        },
      }),
    }
  );

  if (r.ok) return { entregue: true, sumiu: false };

  const erro = await r.json().catch(() => ({} as any));
  const status = erro?.error?.status ?? "";
  /* Na API antiga isto vinha como `results[0].error === "NotRegistered"`.
     Na v1 é o código HTTP mais um `status` em texto — e ler o campo antigo
     aqui daria "não sumiu" para sempre, enchendo a tabela de aparelhos
     mortos. */
  const sumiu =
    r.status === 404 ||
    status === "NOT_FOUND" ||
    status === "UNREGISTERED" ||
    (r.status === 400 && status === "INVALID_ARGUMENT");

  return { entregue: false, sumiu, motivo: `${r.status} ${status}` };
}
