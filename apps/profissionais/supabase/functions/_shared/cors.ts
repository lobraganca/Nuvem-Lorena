/**
 * CORS para as functions chamadas pelo navegador.
 *
 * Antes de um POST com cabeçalho de autenticação, o navegador manda sozinho
 * um pedido OPTIONS perguntando "posso?". Function que não responde a esse
 * pedido nunca chega a ser chamada: o navegador desiste antes, e o erro que
 * aparece na tela é "Failed to send a request to the Edge Function" — que
 * não diz nada sobre a causa e manda procurar defeito no lugar errado.
 *
 * Vale para toda function que a tela invoca. As que são chamadas por
 * máquina — o webhook do Mercado Pago, o pg_cron — não passam por aqui,
 * porque não existe navegador no meio.
 */

export const CABECALHOS_CORS: Record<string, string> = {
  // Qualquer origem: as functions não se protegem por origem (isso é
  // trivial de forjar fora do navegador), e sim exigindo o JWT do usuário e
  // conferindo, no banco, se o anúncio é mesmo dele.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Embrulha o handler: responde o OPTIONS sozinho e carimba os cabeçalhos em
 * todas as respostas — inclusive nas de erro, que são justamente as que
 * precisam chegar à tela para a pessoa saber o que houve.
 */
export function comCors(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CABECALHOS_CORS });
    }

    const resposta = await handler(req);
    const headers = new Headers(resposta.headers);
    for (const [chave, valor] of Object.entries(CABECALHOS_CORS)) {
      headers.set(chave, valor);
    }
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers,
    });
  };
}
