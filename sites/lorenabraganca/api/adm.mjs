// O servidor do /adm. Tudo passa por aqui, com o passe que a senha dela gera:
//   entrar     senha -> passe, guardado num cookie que só o servidor lê
//   sair       apaga o cookie
//   listar     todos os diagnósticos, do mais novo para o mais antigo, e as visitas da página
//   marcar     liga/desliga "já falei com essa pessoa"
//   apagar     apaga um contato de vez (a pessoa pediu: a política de privacidade promete)
//   chave      a chave pública para o celular se inscrever nas notificações
//   inscrever  guarda o celular dela na lista de quem recebe o aviso
//   testar     manda uma notificação de teste
//   negocio    cria ou altera um negócio do funil (e o projeto, quando fecha)
//   apagar_negocio  tira um negócio do funil
//   importar   traz para o funil os contatos da lead page que chegaram antes dele existir
import crypto from "node:crypto";
import { SENHA, faltando, responder, lerCorpo, listarDiagnosticos, resumoDeVisitas, apagarDiagnostico, marcarContatado, guardarInscricao, senhaConfere, criarPasse, passeValido, chavesVapid, avisar,
  ETAPAS, NOME_DA_ETAPA, listarNegocios, lerNegocio, gravarNegocio, apagarNegocio, negocioDoDiagnostico, lerDiagnosticos } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- o que um negócio pode ter ----------
// Tudo o que vem da página é conferido aqui: texto curto, número que é número, data que é data.
const linha = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const bloco = (v, max) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : ""); // anotações guardam a quebra de linha
const data = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
function dinheiro(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e8 ? Math.round(n * 100) / 100 : undefined; // undefined = inválido
}
function whats(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : undefined;
}
const STATUS_DO_PROJETO = ["a_fazer", "andamento", "entregue"];
const reais = (n) => (n === null || n === undefined ? "—" : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }));

/** Junta o que chegou da página com o que já estava gravado. Devolve { negocio } ou { erro }. */
function montarNegocio(antes, d) {
  const agora = new Date().toISOString();
  const n = antes ? { ...antes } : { id: crypto.randomUUID(), criado_em: agora, etapa: "novo", historico: [{ em: agora, texto: "Criado no painel" }] };
  const nome = linha(d.nome, 80);
  if (!nome) return { erro: "Falta o nome." };
  const etapa = d.etapa === undefined ? n.etapa : d.etapa;
  if (!ETAPAS.includes(etapa)) return { erro: "Etapa inválida." };
  const whatsapp = whats(d.whatsapp);
  if (whatsapp === undefined) return { erro: "WhatsApp inválido: use DDD e número." };
  const valor = dinheiro(d.valor), recebido = dinheiro(d.recebido);
  if (valor === undefined || recebido === undefined) return { erro: "Valor inválido." };
  const parcelas = d.parcelas === "" || d.parcelas == null ? null : Number(d.parcelas);
  if (parcelas !== null && !(Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= 48)) return { erro: "Parcelas: de 1 a 48." };
  const contrato_url = linha(d.contrato_url, 500);
  if (contrato_url && !/^https:\/\//.test(contrato_url)) return { erro: "O link do contrato tem de começar com https://" };
  const status = d.status ? String(d.status) : null;
  if (status && !STATUS_DO_PROJETO.includes(status)) return { erro: "Situação do projeto inválida." };

  const historico = [...(n.historico || [])];
  const anotar = (texto) => historico.push({ em: agora, texto });
  if (antes && antes.etapa !== etapa) anotar(`${NOME_DA_ETAPA[antes.etapa]} → ${NOME_DA_ETAPA[etapa]}`);
  if (antes && (antes.valor ?? null) !== valor) anotar(`Valor: ${reais(antes.valor)} → ${reais(valor)}`);
  if (antes && (antes.recebido ?? null) !== recebido) anotar(`Recebido: ${reais(antes.recebido)} → ${reais(recebido)}`);

  Object.assign(n, {
    nome, etapa, whatsapp, valor, recebido, parcelas, contrato_url: contrato_url || null,
    empresa: linha(d.empresa, 80) || null,
    servico: linha(d.servico, 140) || null,
    origem: linha(d.origem, 30) || n.origem || null,
    forma: ["avista", "parcelado"].includes(d.forma) ? d.forma : null,
    proximo_passo: linha(d.proximo_passo, 140) || null,
    proximo_em: data(d.proximo_em),
    motivo_perda: etapa === "perdido" ? linha(d.motivo_perda, 140) || null : null,
    status: etapa === "fechado" ? status || n.status || "a_fazer" : n.status || null,
    prazo: data(d.prazo),
    notas: bloco(d.notas, 3000) || null,
    atualizado_em: agora,
    // quando fechou ou perdeu: é o que conta "fechados no mês"
    fechado_em: etapa === "fechado" ? (antes?.etapa === "fechado" ? n.fechado_em : agora) : null,
    perdido_em: etapa === "perdido" ? (antes?.etapa === "perdido" ? n.perdido_em : agora) : null,
    historico: historico.slice(-60),
  });
  return { negocio: n };
}

// Ela pediu para não digitar a senha toda hora (01/11). O passe vai por DOIS caminhos,
// e qualquer um basta:
//  - um cookie gravado pelo servidor (o Safari guarda esse tipo por muito mais tempo
//    que o escrito pela página), HttpOnly;
//  - uma cópia que a página guarda no localStorage e manda no cabeçalho.
// Só o cookie bastaria no papel. Na prática, no app de tela inicial do iPhone, ela
// digitava a senha e "não acontecia nada": a senha passava, o cookie não voltava na
// chamada seguinte, e a tela caía de novo na senha, vazia. A cópia é a reserva, e o
// cookie passou de SameSite=Strict para Lax (o Strict é o suspeito de ser barrado
// nesse modo; o Lax continua sem ir em pedido vindo de outro site).
// Vale 180 dias e se renova a cada uso: só volta a pedir senha depois de 6 meses sem
// abrir, ao tocar em Sair, ou se a senha mudar na Vercel.
const DIAS = 180;
const COOKIE = "adm_passe";
const cookie = (valor, segundos) => `${COOKIE}=${valor}; Path=/api/adm; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
function lerCookie(req) {
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return "";
}

export default async function handler(req, res) {
  const falta = faltando();
  if (!SENHA) falta.push("ADMIN_SENHA");
  if (falta.length) return responder(res, 503, { erro: "nao-configurado", falta });
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });

  const d = lerCorpo(req);

  if (d.acao === "entrar") {
    if (!senhaConfere(d.senha)) {
      await esperar(900); // atrasa quem tenta adivinhar a senha, sem incomodar quem erra uma vez
      return responder(res, 401, { erro: "Senha incorreta." });
    }
    const passe = criarPasse(DIAS);
    res.setHeader("Set-Cookie", cookie(passe, DIAS * 86400));
    return responder(res, 200, { ok: true, passe });
  }

  if (d.acao === "sair") {
    res.setHeader("Set-Cookie", cookie("", 0));
    return responder(res, 204);
  }

  // o cabeçalho Authorization ainda vale: é como chegam os passes antigos, do localStorage
  const passe = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || lerCookie(req);
  if (!passeValido(passe)) return responder(res, 401, { erro: "Entre de novo." });
  const renovado = criarPasse(DIAS); // renova a cada uso, pelos dois caminhos
  res.setHeader("Set-Cookie", cookie(renovado, DIAS * 86400));

  try {
    switch (d.acao) {
      case "listar": {
        // as visitas são extra: se a conta delas falhar, a lista de pessoas aparece mesmo assim
        const [diagnosticos, negocios, visitas] = await Promise.all([
          listarDiagnosticos(),
          listarNegocios(),
          resumoDeVisitas().catch((e) => { console.warn("visitas:", e.message); return null; }),
        ]);
        return responder(res, 200, { diagnosticos, negocios, visitas, passe: renovado });
      }
      case "marcar": {
        if (typeof d.id !== "string" || !UUID.test(d.id)) return responder(res, 400, { erro: "Diagnóstico inválido." });
        const contatado_em = await marcarContatado(d.id, Boolean(d.feito));
        if (contatado_em === undefined) return responder(res, 404, { erro: "Diagnóstico não encontrado." });
        return responder(res, 200, { contatado_em });
      }
      case "apagar": {
        if (typeof d.id !== "string" || !UUID.test(d.id)) return responder(res, 400, { erro: "Diagnóstico inválido." });
        const apagou = await apagarDiagnostico(d.id);
        // a pessoa pediu para ser apagada: sai do funil também, a não ser que já seja cliente
        const negocio = await lerNegocio(d.id);
        if (negocio && negocio.etapa !== "fechado") await apagarNegocio(d.id);
        return responder(res, apagou ? 200 : 404, apagou ? { ok: true } : { erro: "Esse contato já não existia." });
      }
      case "negocio": {
        if (d.id !== undefined && (typeof d.id !== "string" || !UUID.test(d.id))) return responder(res, 400, { erro: "Negócio inválido." });
        const antes = d.id ? await lerNegocio(d.id) : null;
        if (d.id && !antes) return responder(res, 404, { erro: "Esse negócio não existe mais." });
        const { negocio, erro } = montarNegocio(antes, d.dados || {});
        if (erro) return responder(res, 400, { erro });
        await gravarNegocio(negocio);
        return responder(res, 200, { negocio });
      }
      case "apagar_negocio": {
        if (typeof d.id !== "string" || !UUID.test(d.id)) return responder(res, 400, { erro: "Negócio inválido." });
        const apagou = await apagarNegocio(d.id);
        return responder(res, apagou ? 200 : 404, apagou ? { ok: true } : { erro: "Esse negócio já não existia." });
      }
      case "importar": {
        const ids = Array.isArray(d.ids) ? d.ids.filter((x) => typeof x === "string" && UUID.test(x)).slice(0, 500) : [];
        let trazidos = 0;
        for (const x of await lerDiagnosticos(ids)) if (x.nome && x.whatsapp && (await negocioDoDiagnostico(x))) trazidos++;
        return responder(res, 200, { trazidos, negocios: await listarNegocios() });
      }
      case "chave": {
        const { publica } = await chavesVapid();
        return responder(res, 200, { publica });
      }
      case "inscrever": {
        const i = d.inscricao;
        const ok = i && typeof i.endpoint === "string" && /^https:\/\//.test(i.endpoint) && i.endpoint.length < 1000
          && i.keys && typeof i.keys.p256dh === "string" && typeof i.keys.auth === "string";
        if (!ok) return responder(res, 400, { erro: "Inscrição inválida." });
        const inscricao = { endpoint: i.endpoint, keys: { p256dh: i.keys.p256dh, auth: i.keys.auth } };
        await guardarInscricao(inscricao);
        return responder(res, 200, { ok: true });
      }
      case "testar": {
        const r = await avisar({ titulo: "Notificações ligadas", corpo: "É assim que vai chegar o aviso de um diagnóstico novo.", url: "/adm/", tag: "teste" });
        return responder(res, 200, r);
      }
      default:
        return responder(res, 400, { erro: "Ação desconhecida." });
    }
  } catch (e) {
    console.error("adm:", d.acao, e.message);
    return responder(res, 502, { erro: "O banco não respondeu.", detalhe: e.message });
  }
}
