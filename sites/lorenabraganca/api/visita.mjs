// Conta uma visita à página (ou ao portfólio). Sem cookie e sem dado pessoal: a página
// manda só qual página foi e um número aleatório que ela guarda no navegador, para saber
// se é a mesma pessoa voltando. Responde sempre 204 e nunca atrapalha quem está vendo.
import { faltando, responder, lerCorpo, PAGINAS, contarVisita } from "./_lib.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// robô que roda JavaScript (o de prévia de link não roda, então nem chega aqui)
const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
  if (faltando().length) return responder(res, 204);
  const d = lerCorpo(req);
  if (!PAGINAS.includes(d.pagina) || typeof d.visitante !== "string" || !UUID.test(d.visitante)) return responder(res, 400, { erro: "Visita inválida." });
  if (ROBO.test(String(req.headers["user-agent"] || ""))) return responder(res, 204);
  try {
    await contarVisita(d.pagina, d.visitante.toLowerCase(), d.origem);
  } catch (e) {
    console.warn("visita não contou:", e.message);
  }
  return responder(res, 204);
}
