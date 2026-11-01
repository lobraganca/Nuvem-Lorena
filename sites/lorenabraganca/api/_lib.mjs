// Peças comuns das funções do site. O "_" no começo do nome faz a Vercel NÃO
// publicar este arquivo como endereço: ele só é usado por diagnostico.mjs e adm.mjs.
//
// .mjs, e não .js: a raiz do repositório tem "type": "module" no package.json, e um
// .js aqui seria lido como um formato ou outro conforme quem olhasse. .mjs é sempre o mesmo.
//
// Ninguém fala com o banco direto do navegador. Só estas funções, com a chave do
// banco, que mora nas variáveis de ambiente da Vercel e nunca vai para a página.
import crypto from "node:crypto";

// O banco é o Redis da Upstash que a Vercel liga ao projeto (Storage > Upstash).
// Ela mesma cria as variáveis; os nomes mudam com o prefixo escolhido na hora de ligar
// (KV_ por padrão), então aceitamos qualquer *_REST_API_URL / *_REST_API_TOKEN.
// O Supabase ficou de fora porque o plano grátis dela já estava no limite (01/11).
function credenciaisDoBanco() {
  const env = process.env;
  let url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "";
  let token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "";
  for (const [k, v] of Object.entries(env)) {
    if (!url && k.endsWith("_REST_API_URL")) url = v;
    if (!token && k.endsWith("_REST_API_TOKEN") && !k.includes("READ_ONLY")) token = v; // a de só leitura não grava
  }
  return { url: url.replace(/\/+$/, ""), token };
}
const BANCO = credenciaisDoBanco();
const SENHA = process.env.ADMIN_SENHA || "";

/** O que falta ligar na Vercel. "banco" = Storage > Upstash ainda não conectado ao projeto. */
function faltando() {
  return BANCO.url && BANCO.token ? [] : ["banco"];
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

/** Vários comandos do Redis numa ida só (a API REST da Upstash). Erro vira exceção:
 *  função de dados que falha nunca devolve lista vazia (ver o CLAUDE.md do repositório). */
async function redis(...comandos) {
  const r = await fetch(BANCO.url + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + BANCO.token, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(corpo)) throw new Error(`banco respondeu ${r.status}: ${JSON.stringify(corpo).slice(0, 200)}`);
  const erro = corpo.find((x) => x && x.error);
  if (erro) throw new Error("banco: " + erro.error);
  return corpo.map((x) => x.result);
}

// ---------- os diagnósticos ----------
// Cada um é um JSON em "diag:<id>", e "diags" é a fila por data (pontuação = quando nasceu).

const chaveDo = (id) => "diag:" + id;

/** Junta campos novos no registro de um diagnóstico — ou cria, se ele ainda não existe.
 *  As etapas chegam em qualquer ordem (a rede pode atrasar uma), e nenhuma apaga a outra. */
async function juntar(id, campos) {
  const [atual] = await redis(["GET", chaveDo(id)]);
  const antes = atual ? JSON.parse(atual) : { id, criado_em: new Date().toISOString() };
  const junto = { ...antes, ...campos, id, criado_em: antes.criado_em };
  await redis(
    ["SET", chaveDo(id), JSON.stringify(junto)],
    ["ZADD", "diags", "NX", Date.parse(junto.criado_em), id],
  );
  return { junto, novo: !atual };
}

/** Desde 31/10 o contato vem ANTES das perguntas (etapa "inicio"); o resultado chega depois. */
async function gravarInicio(id, contato) { return juntar(id, contato); }
async function gravarResultado(linha) { return juntar(linha.id, { ...linha, concluido_em: new Date().toISOString() }); }
/** A etapa antiga: contato DEPOIS do resultado. Fica para quem estiver com a página velha aberta. */
async function gravarContato(linha, contato) { return juntar(linha.id, { ...linha, ...contato }); }

async function listarDiagnosticos(limite = 500) {
  const [ids] = await redis(["ZREVRANGE", "diags", 0, limite - 1]);
  if (!ids.length) return [];
  const [jsons] = await redis(["MGET", ...ids.map(chaveDo)]);
  return jsons.filter(Boolean).map((j) => JSON.parse(j));
}

/** Liga/desliga "já falei". Devolve undefined se o diagnóstico não existe. */
async function marcarContatado(id, feito) {
  const [atual] = await redis(["GET", chaveDo(id)]);
  if (!atual) return undefined;
  const d = JSON.parse(atual);
  d.contatado_em = feito ? new Date().toISOString() : null;
  await redis(["SET", chaveDo(id), JSON.stringify(d), "XX"]);
  return d.contatado_em;
}

// ---------- as visitas da página ----------
// Ela quis ver no /adm quantas visitas a página teve (01/11). O painel de visitas da
// Vercel não deixa outro programa ler os números no plano grátis, então a própria
// página conta, aqui: um contador por dia ("visitas:inicio:2026-11-01") e, para
// "pessoas diferentes", um HyperLogLog por dia (conta únicos sem guardar quem é).
// Os dias são os de São Paulo, não os do servidor: senão a visita das 22h caía amanhã.
const FUSO = "America/Sao_Paulo";
const GUARDAR_DIAS = 100;
const PAGINAS = ["inicio", "portifolio"];

function diaDe(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}
function ultimosDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) dias.push(diaDe(new Date(Date.now() - i * 864e5)));
  return [...new Set(dias)];
}

async function contarVisita(pagina, visitante) {
  const dia = diaDe(), ttl = GUARDAR_DIAS * 86400;
  await redis(
    ["INCR", `visitas:${pagina}:${dia}`], ["EXPIRE", `visitas:${pagina}:${dia}`, ttl],
    ["PFADD", `unicos:${pagina}:${dia}`, visitante], ["EXPIRE", `unicos:${pagina}:${dia}`, ttl],
    ["INCR", `visitas:${pagina}:total`],
  );
}

async function resumoDeVisitas() {
  const dias = ultimosDias(30);
  const [inicio, pessoasSemana, pessoasMes, total, portfolio] = await redis(
    ["MGET", ...dias.map((d) => `visitas:inicio:${d}`)],
    ["PFCOUNT", ...dias.slice(-7).map((d) => `unicos:inicio:${d}`)],
    ["PFCOUNT", ...dias.map((d) => `unicos:inicio:${d}`)],
    ["GET", "visitas:inicio:total"],
    ["MGET", ...dias.map((d) => `visitas:portifolio:${d}`)],
  );
  const porDia = inicio.map((v, i) => ({ dia: dias[i], visitas: Number(v) || 0 }));
  const soma = (lista) => lista.reduce((t, x) => t + x, 0);
  return {
    porDia,
    hoje: porDia[porDia.length - 1].visitas,
    semana: soma(porDia.slice(-7).map((x) => x.visitas)),
    mes: soma(porDia.map((x) => x.visitas)),
    pessoasSemana: Number(pessoasSemana) || 0,
    pessoasMes: Number(pessoasMes) || 0,
    total: Number(total) || 0,
    portfolioMes: soma(portfolio.map((v) => Number(v) || 0)),
  };
}

// ---------- os celulares inscritos para o aviso ----------
async function guardarInscricao(inscricao) { await redis(["HSET", "push", inscricao.endpoint, JSON.stringify(inscricao)]); }
async function listarInscricoes() { const [v] = await redis(["HVALS", "push"]); return v.map((j) => JSON.parse(j)); }
async function apagarInscricao(endpoint) { await redis(["HDEL", "push", endpoint]); }

// ---------- entrada no /adm: uma senha só, a dela, guardada na Vercel ----------

function resumo(texto) { return crypto.createHash("sha256").update(String(texto)).digest(); }

function senhaConfere(tentativa) {
  if (!SENHA || typeof tentativa !== "string") return false;
  // compara os resumos, de tamanho fixo, em tempo constante: não dá pista do tamanho da senha
  return crypto.timingSafeEqual(resumo(tentativa), resumo(SENHA));
}

// A assinatura do passe depende da senha: trocar a senha na Vercel desloga todo mundo.
function segredoDoPasse() { return resumo("adm|" + BANCO.token + "|" + SENHA); }

function criarPasse(dias) {
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
  const ler = async () => { const [j] = await redis(["GET", "config:vapid"]); return j ? JSON.parse(j) : null; };
  const existentes = await ler();
  if (existentes) return existentes;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const publica = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]));
  // NX: se duas chamadas criarem ao mesmo tempo, fica a primeira — e as duas releem a mesma
  await redis(["SET", "config:vapid", JSON.stringify({ publica, privada: privateKey.export({ format: "jwk" }) }), "NX"]);
  return ler();
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
  const inscricoes = await listarInscricoes();
  if (!inscricoes.length) return { enviadas: 0, falhas: 0, aparelhos: 0 };
  const vapid = await chavesVapid();
  let enviadas = 0, falhas = 0;
  await Promise.all(inscricoes.map(async (inscricao) => {
    const { endpoint } = inscricao;
    try {
      const status = await enviarPara(inscricao, mensagem, vapid);
      if (status >= 200 && status < 300) { enviadas++; return; }
      falhas++;
      if (status === 404 || status === 410) {
        await apagarInscricao(endpoint);
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
  SENHA, faltando, responder, lerCorpo,
  gravarInicio, gravarResultado, gravarContato, listarDiagnosticos, marcarContatado, guardarInscricao,
  PAGINAS, contarVisita, resumoDeVisitas,
  senhaConfere, criarPasse, passeValido,
  chavesVapid, cifrar, assinarJwt, avisar,
};
