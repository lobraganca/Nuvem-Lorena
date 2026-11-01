// Recebe o diagnóstico feito na página principal, em dois momentos (desde 31/10):
//   etapa "inicio":    nome e WhatsApp, ANTES das perguntas — aí a Lorena recebe o aviso;
//   etapa "resultado": as respostas e o índice, no mesmo registro.
// A etapa "contato" (contato DEPOIS do resultado) é do jeito antigo e segue aceita, para
// quem estiver com a página velha aberta.
// A página manda e não espera resposta: se isto falhar, o WhatsApp abre do mesmo jeito.
import { faltando, responder, lerCorpo, gravarInicio, gravarResultado, gravarContato, avisar, origemLimpa } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Só dígitos, com o 55 do Brasil na frente: (31) 99999-8888 vira 5531999998888. */
function whatsappNormalizado(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

/** As respostas chegam como { "Ramo": "Comércio ou loja", ... }. Só passa texto curto. */
function respostasLimpas(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const limpas = {};
  for (const [k, v] of Object.entries(r).slice(0, 12)) {
    const chave = texto(k, 40), valor = texto(v, 120);
    if (chave && valor) limpas[chave] = valor;
  }
  return Object.keys(limpas).length ? limpas : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
  if (faltando().length) return responder(res, 503, { erro: "O banco ainda não foi ligado.", falta: faltando() });

  const d = lerCorpo(req);
  const id = typeof d.id === "string" && UUID.test(d.id) ? d.id.toLowerCase() : null;

  if (d.etapa === "inicio") {
    const nome = texto(d.nome, 80);
    const whatsapp = whatsappNormalizado(d.whatsapp);
    const empresa = texto(d.empresa, 80) || null;
    if (!id || !nome || !whatsapp) return responder(res, 400, { erro: "Nome e WhatsApp são obrigatórios." });
    try {
      await gravarInicio(id, { nome, whatsapp, empresa, origem: origemLimpa(d.origem), contato_em: new Date().toISOString() });
    } catch (e) {
      console.error("o contato não gravou:", e.message);
      return responder(res, 502, { erro: "Não foi possível gravar agora." });
    }
    try { // o aviso não pode derrubar o cadastro: o contato já está salvo
      await avisar({ titulo: "Novo contato", corpo: `${nome}${empresa ? " · " + empresa : ""} começou o diagnóstico`, url: "/adm/", tag: id });
    } catch (e) {
      console.warn("o contato foi salvo, mas o aviso falhou:", e.message);
    }
    return responder(res, 204);
  }

  const respostas = respostasLimpas(d.respostas);
  const indice = Number.isInteger(d.indice) && d.indice >= 0 && d.indice <= 100 ? d.indice : null;
  const nivel = texto(d.nivel, 40);
  if (!id || !respostas || indice === null || !nivel) return responder(res, 400, { erro: "Diagnóstico incompleto." });
  const linha = { id, respostas, indice, nivel };

  try {
    if (d.etapa === "resultado") {
      await gravarResultado(linha); // junta no registro do contato; refazer substitui o resultado
      return responder(res, 204);
    }

    if (d.etapa === "contato") {
      const nome = texto(d.nome, 80);
      const whatsapp = whatsappNormalizado(d.whatsapp);
      const empresa = texto(d.empresa, 80) || null;
      if (!nome || !whatsapp) return responder(res, 400, { erro: "Nome e WhatsApp são obrigatórios." });

      await gravarContato(linha, { nome, whatsapp, empresa, contato_em: new Date().toISOString() });

      // O aviso não pode derrubar o cadastro: se a notificação falhar, o contato já está salvo.
      try {
        await avisar({
          titulo: "Novo diagnóstico",
          corpo: `${nome}${empresa ? " · " + empresa : ""} — ${indice}/100, ${nivel}`,
          url: "/adm/",
          tag: id,
        });
      } catch (e) {
        console.warn("o contato foi salvo, mas o aviso falhou:", e.message);
      }
      return responder(res, 204);
    }

    return responder(res, 400, { erro: "Etapa desconhecida." });
  } catch (e) {
    console.error("diagnóstico não gravou:", e.message);
    return responder(res, 502, { erro: "Não foi possível gravar agora." });
  }
}
