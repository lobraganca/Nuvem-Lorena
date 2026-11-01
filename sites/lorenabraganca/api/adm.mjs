// O servidor do /adm. Tudo passa por aqui, com o passe que a senha dela gera:
//   entrar     senha -> passe, guardado num cookie que só o servidor lê
//   sair       apaga o cookie
//   listar     todos os diagnósticos, do mais novo para o mais antigo, e as visitas da página
//   marcar     liga/desliga "já falei com essa pessoa"
//   apagar     apaga um contato de vez (a pessoa pediu: a política de privacidade promete)
//   chave      a chave pública para o celular se inscrever nas notificações
//   inscrever  guarda o celular dela na lista de quem recebe o aviso
//   testar     manda uma notificação de teste
import { SENHA, faltando, responder, lerCorpo, listarDiagnosticos, resumoDeVisitas, apagarDiagnostico, marcarContatado, guardarInscricao, senhaConfere, criarPasse, passeValido, chavesVapid, avisar } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
        const [diagnosticos, visitas] = await Promise.all([
          listarDiagnosticos(),
          resumoDeVisitas().catch((e) => { console.warn("visitas:", e.message); return null; }),
        ]);
        return responder(res, 200, { diagnosticos, visitas, passe: renovado });
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
        return responder(res, apagou ? 200 : 404, apagou ? { ok: true } : { erro: "Esse contato já não existia." });
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
