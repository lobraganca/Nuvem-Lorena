// Peças comuns das funções do site. O "_" no começo do nome faz a Vercel NÃO
// publicar este arquivo como endereço: ele só é usado por diagnostico.mjs e adm.mjs.
//
// .mjs, e não .js: a raiz do repositório tem "type": "module" no package.json, e um
// .js aqui seria lido como um formato ou outro conforme quem olhasse. .mjs é sempre o mesmo.
//
// Ninguém fala com o banco direto do navegador. Só estas funções, com a chave de
// serviço, que mora nas variáveis de ambiente da Vercel e nunca vai para a página.
// Por isso as tabelas têm RLS ligado e nenhuma regra: a chave pública não lê nada.
import crypto from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const CHAVE_SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const SENHA = process.env.ADMIN_SENHA || "";

/** O que falta configurar na Vercel, em nomes que ela reconhece na tela. */
function faltando() {
  const falta = [];
  if (!SUPABASE_URL) falta.push("SUPABASE_URL");
  if (!CHAVE_SERVICO) falta.push("SUPABASE_SERVICE_ROLE_KEY");
  return falta;
}

function responder(res, status, corpo) {
  res.setHeader("Cache-Control", "no-store");
  if (corpo === undefined) { res.statusCode = status; return res.end(); }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(corpo));
}

/** O corpo pode chegar já lido (JSON), como texto (sendBeacon) ou vazio. */
function lerCorpo(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(String(b)); } catch { return {}; }
}

/** Uma chamada à API REST do Supabase, como serviço. Erro do banco vira exceção:
 *  função de dados que falha nunca devolve lista vazia (ver o CLAUDE.md do repositório). */
async function banco(caminho, { metodo = "GET", corpo, preferir } = {}) {
  const cabecalhos = { apikey: CHAVE_SERVICO, "Content-Type": "application/json" };
  // As chaves novas do Supabase (sb_secret_...) não são JWT: vão só no apikey.
  // As antigas (service_role, um JWT) vão também no Authorization.
  if (!CHAVE_SERVICO.startsWith("sb_")) cabecalhos.Authorization = "Bearer " + CHAVE_SERVICO;
  if (preferir) cabecalhos.Prefer = preferir;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo, headers: cabecalhos, body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) {
    const e = new Error(`banco respondeu ${r.status}: ${texto.slice(0, 300)}`);
    e.status = r.status;
    throw e;
  }
  return texto ? JSON.parse(texto) : null;
}

// ---------- entrada no /adm: uma senha só, a dela, guardada na Vercel ----------

function resumo(texto) { return crypto.createHash("sha256").update(String(texto)).digest(); }

function senhaConfere(tentativa) {
  if (!SENHA || typeof tentativa !== "string") return false;
  // compara os resumos, de tamanho fixo, em tempo constante: não dá pista do tamanho da senha
  return crypto.timingSafeEqual(resumo(tentativa), resumo(SENHA));
}

// A assinatura do passe depende da senha: trocar a senha na Vercel desloga todo mundo.
function segredoDoPasse() { return resumo("adm|" + CHAVE_SERVICO + "|" + SENHA); }

function criarPasse(dias = 30) {
  const validade = String(Date.now() + dias * 864e5);
  const assinatura = crypto.createHmac("sha256", segredoDoPasse()).update(validade).digest("base64url");
  return validade + "." + assinatura;
}

function passeValido(passe) {
  if (!SENHA || typeof passe !== "string") return false;
  const [validade, assinatura] = passe.split(".");
  if (!validade || !assinatura) return false;
  const esperada = crypto.createHmac("sha256", segredoDoPasse()).update(validade).digest("base64url");
  const a = Buffer.from(assinatura), b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(validade) > Date.now();
}

// ---------- notificação no celular (Web Push, RFC 8291 + VAPID, RFC 8292) ----------
// Feito à mão com o crypto do Node para não precisar de dependência nenhuma:
// a pasta do site não tem package.json, e um a mais seria publicado junto.

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/** O par de chaves que identifica o site para o serviço de notificação.
 *  Nasce na primeira vez que alguém pede e fica no banco: a parte privada nunca sai do servidor. */
async function chavesVapid() {
  const ler = () => banco("configuracao?chave=eq.vapid&select=valor");
  const existentes = await ler();
  if (existentes.length) return existentes[0].valor;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const publica = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]));
  const valor = { publica, privada: privateKey.export({ format: "jwk" }) };
  // se duas chamadas criarem ao mesmo tempo, fica a primeira — e as duas releem a mesma
  await banco("configuracao", { metodo: "POST", corpo: { chave: "vapid", valor }, preferir: "resolution=ignore-duplicates,return=minimal" });
  return (await ler())[0].valor;
}

function assinarJwt(conteudo, jwkPrivada) {
  const cabeca = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const corpo = b64u(JSON.stringify(conteudo));
  const chave = crypto.createPrivateKey({ key: jwkPrivada, format: "jwk" });
  const assinatura = crypto.sign("sha256", Buffer.from(cabeca + "." + corpo), { key: chave, dsaEncoding: "ieee-p1363" });
  return `${cabeca}.${corpo}.${b64u(assinatura)}`;
}

/** Cifra a mensagem para UM aparelho. Só aquele aparelho consegue ler:
 *  a Apple e o Google só carregam o envelope fechado. */
function cifrar(inscricao, mensagem) {
  const doAparelho = Buffer.from(inscricao.keys.p256dh, "base64url");
  const segredo = Buffer.from(inscricao.keys.auth, "base64url");
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const doServidor = ecdh.getPublicKey();
  const compartilhado = ecdh.computeSecret(doAparelho);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), doAparelho, doServidor]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", compartilhado, segredo, info, 32));
  const sal = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cifra = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const texto = Buffer.concat([Buffer.from(JSON.stringify(mensagem)), Buffer.from([2])]); // 2 = último bloco
  const cifrado = Buffer.concat([cifra.update(texto), cifra.final(), cifra.getAuthTag()]);
  const tamanhoDoBloco = Buffer.alloc(4);
  tamanhoDoBloco.writeUInt32BE(4096);
  return Buffer.concat([sal, tamanhoDoBloco, Buffer.from([doServidor.length]), doServidor, cifrado]);
}

async function enviarPara(inscricao, mensagem, vapid) {
  const jwt = assinarJwt({
    aud: new URL(inscricao.endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600, // a Apple recusa validade acima de 24h
    sub: "https://www.lorenabraganca.com.br",
  }, vapid.privada);
  const r = await fetch(inscricao.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${vapid.publica}`,
    },
    body: cifrar(inscricao, mensagem),
  });
  return r.status;
}

/** Avisa todos os aparelhos inscritos. Aparelho que o serviço diz não existir mais
 *  (404/410: app apagado, permissão retirada) sai da lista, para não tentar para sempre. */
async function avisar(mensagem) {
  const inscricoes = await banco("inscricoes_push?select=endpoint,inscricao");
  if (!inscricoes.length) return { enviadas: 0, falhas: 0, aparelhos: 0 };
  const vapid = await chavesVapid();
  let enviadas = 0, falhas = 0;
  await Promise.all(inscricoes.map(async ({ endpoint, inscricao }) => {
    try {
      const status = await enviarPara(inscricao, mensagem, vapid);
      if (status >= 200 && status < 300) { enviadas++; return; }
      falhas++;
      if (status === 404 || status === 410) {
        await banco("inscricoes_push?endpoint=eq." + encodeURIComponent(endpoint), { metodo: "DELETE" });
      } else {
        console.warn("notificação recusada:", status, new URL(endpoint).host);
      }
    } catch (e) {
      falhas++;
      console.warn("notificação falhou:", e.message);
    }
  }));
  return { enviadas, falhas, aparelhos: inscricoes.length };
}

export {
  SENHA, faltando, responder, lerCorpo, banco,
  senhaConfere, criarPasse, passeValido,
  chavesVapid, cifrar, assinarJwt, avisar,
};
