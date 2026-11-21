// Recebe as respostas de um formulário de cliente (desde 19/11; o primeiro é o /pousadamare).
// A página manda o que já foi respondido a cada pergunta (concluido: false) e tudo de novo
// no fim (concluido: true). Mandar de novo do mesmo aparelho (mesmo id) atualiza a mesma
// resposta em vez de criar outra. O aviso no celular só sai quando a pessoa termina. A Lorena recebe o aviso no celular, e as
// respostas aparecem no /adm, em Diagnósticos > Formulários de clientes.
import { faltando, responder, lerCorpo, FORMULARIOS, gravarFormulario, avisar } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const linha = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
// resposta escrita guarda a quebra de linha: a pessoa pode listar os passeios um embaixo do outro
const bloco = (v, max) => (typeof v === "string" ? v.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");

/** Só dígitos, com o 55 do Brasil na frente: (73) 99999-8888 vira 5573999998888. */
function whatsappNormalizado(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

/** Chegam como [{ secao, pergunta, resposta }]. Resposta em branco fica: é "não respondeu". */
function respostasLimpas(r) {
  if (!Array.isArray(r)) return null;
  const limpas = r.slice(0, 40)
    .map((x) => ({ secao: linha(x?.secao, 80), pergunta: linha(x?.pergunta, 240), resposta: bloco(x?.resposta, 2000) }))
    .filter((x) => x.pergunta);
  return limpas.some((x) => x.resposta) ? limpas : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
  if (faltando().length) return responder(res, 503, { erro: "O banco ainda não foi ligado.", falta: faltando() });

  const d = lerCorpo(req);
  const id = typeof d.id === "string" && UUID.test(d.id) ? d.id.toLowerCase() : null;
  const formulario = typeof d.formulario === "string" && Object.hasOwn(FORMULARIOS, d.formulario) ? d.formulario : null;
  if (!id || !formulario) return responder(res, 400, { erro: "Formulário inválido." });
  const nome = linha(d.nome, 80);
  if (!nome) return responder(res, 400, { erro: "Falta o nome." });
  const whatsapp = d.whatsapp ? whatsappNormalizado(d.whatsapp) : null;
  if (d.whatsapp && !whatsapp) return responder(res, 400, { erro: "WhatsApp inválido: use DDD e número." });
  const concluido = d.concluido !== false; // a página antiga não mandava o campo: era sempre no fim
  // 21/11: no pedido de proposta o nome e o WhatsApp vêm PRIMEIRO, e ficam gravados assim
  // que a pessoa escreve, mesmo que ela pare ali ("tem que ficar gravado pra eu entrar em
  // contato"). Então, no meio do caminho, pode chegar só o contato, sem resposta nenhuma.
  const respostas = respostasLimpas(d.respostas) || (concluido ? null : []);
  if (!respostas) return responder(res, 400, { erro: "Nenhuma resposta chegou." });

  const cliente = FORMULARIOS[formulario];
  let antes;
  try {
    ({ antes } = await gravarFormulario({ id, formulario, cliente, nome, whatsapp, respostas, concluido }));
  } catch (e) {
    console.error("o formulário não gravou:", e.message);
    return responder(res, 502, { erro: "Não foi possível gravar agora." });
  }
  if (!concluido) {
    // no meio do caminho: salva e não avisa. A exceção é o pedido de proposta na primeira vez
    // que chega um WhatsApp: é um contato que ela pode chamar, mesmo que a pessoa pare ali.
    if (formulario === "orcamento" && whatsapp && !antes?.whatsapp && !antes?.concluido_em) {
      try {
        await avisar({ titulo: "Novo contato · Pedido de proposta", corpo: `${nome} deixou o WhatsApp e começou o pedido`, url: "/adm/#formularios", tag: "form-" + id });
      } catch (e) { console.warn("o contato foi salvo, mas o aviso falhou:", e.message); }
    }
    return responder(res, 204);
  }
  const novo = !antes?.concluido_em;
  try { // o aviso não pode derrubar a resposta: ela já está salva
    await avisar({
      titulo: (novo ? "Nova resposta · " : "Resposta atualizada · ") + cliente,
      // no pedido de orçamento, o aviso já diz a tarefa: é o que decide se ela chama logo
      corpo: formulario === "orcamento"
        ? `${nome}: ${(respostas[0]?.resposta || "").replace(/\s+/g, " ").slice(0, 110)}`
        : novo ? `${nome} respondeu o formulário` : `${nome} mudou as respostas`,
      url: "/adm/#formularios",
      tag: "form-" + id,
    });
  } catch (e) {
    console.warn("a resposta foi salva, mas o aviso falhou:", e.message);
  }
  return responder(res, 204);
}
