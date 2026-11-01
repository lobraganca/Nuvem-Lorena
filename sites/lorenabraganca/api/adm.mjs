// O servidor do /adm. Tudo passa por aqui, com o passe que a senha dela gera:
//   entrar     senha -> passe (vale 30 dias)
//   listar     todos os diagnósticos, do mais novo para o mais antigo
//   marcar     liga/desliga "já falei com essa pessoa"
//   chave      a chave pública para o celular se inscrever nas notificações
//   inscrever  guarda o celular dela na lista de quem recebe o aviso
//   testar     manda uma notificação de teste
import { SENHA, faltando, responder, lerCorpo, banco, senhaConfere, criarPasse, passeValido, chavesVapid, avisar } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
    return responder(res, 200, { passe: criarPasse() });
  }

  const passe = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!passeValido(passe)) return responder(res, 401, { erro: "Entre de novo." });

  try {
    switch (d.acao) {
      case "listar": {
        const diagnosticos = await banco("diagnosticos?select=*&order=criado_em.desc&limit=500");
        return responder(res, 200, { diagnosticos });
      }
      case "marcar": {
        if (typeof d.id !== "string" || !UUID.test(d.id)) return responder(res, 400, { erro: "Diagnóstico inválido." });
        const contatado_em = d.feito ? new Date().toISOString() : null;
        await banco("diagnosticos?id=eq." + d.id, { metodo: "PATCH", corpo: { contatado_em }, preferir: "return=minimal" });
        return responder(res, 200, { contatado_em });
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
        await banco("inscricoes_push?on_conflict=endpoint", {
          metodo: "POST", corpo: { endpoint: i.endpoint, inscricao }, preferir: "resolution=merge-duplicates,return=minimal",
        });
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
