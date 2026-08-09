/**
 * Um app, um endereço só.
 *
 * `procuroapp.com.br` e `www.procuroapp.com.br` são o mesmo site para uma
 * pessoa e dois sites diferentes para o navegador: sessão, dados guardados e
 * a senha temporária do login do Google ficam separados por endereço, sem se
 * enxergarem.
 *
 * É isso que quebrava o login. Ele começa guardando um segredo e, na volta,
 * confere se bate. Começando em um endereço e terminando no outro, a
 * conferência falha e o Google devolve `error=invalid_request` — um erro que
 * parece de configuração e é, na verdade, de endereço.
 *
 * A troca acontece antes de o app desenhar qualquer coisa, para que nada
 * chegue a ser guardado no endereço errado. Caminho, filtros e o pedaço
 * depois do `#` (onde vem o token do login) são preservados inteiros — perder
 * o `#` aqui seria trocar um login quebrado por outro.
 *
 * ── A troca de nome, e por que ela não é uma linha só ──────────────────────
 *
 * O app mudou de "Busca Itabirito" para "procurô", e o endereço vai de
 * `buscaitabirito.com.br` para `procuroapp.com.br`. Mandar todo mundo para o
 * endereço novo de uma vez é o jeito mais fácil de derrubar o app inteiro:
 * enquanto o domínio novo não estiver ligado na Vercel, com HTTPS emitido e
 * autorizado no Google e no Supabase, esse desvio joga quem abrir o app numa
 * página que não existe — e, pior, quem já tem o app instalado fica sem
 * caminho de volta.
 *
 * Por isso os dois endereços conviveram até a virada: cada um levava à sua
 * própria versão com `www`, e nenhum mandava ninguém para o outro. A chave
 * foi virada em 9/8/2026, depois de o domínio novo responder com certificado
 * e de estar autorizado no Google e no Supabase — nessa ordem, que é a que
 * não derruba o login.
 *
 * O domínio antigo continua no ar e agora redireciona para o novo. Ele não
 * deve ser desligado: é o que segura quem guardou o link antigo e quem tem o
 * app instalado por ele.
 */

/** Endereço oficial do app. */
const HOST_NOVO = "www.procuroapp.com.br";

/** Endereço anterior. Continua no ar, redirecionando para o novo. */
const HOST_ANTIGO = "www.buscaitabirito.com.br";

/**
 * Virado em 9/8/2026, depois de cumpridas as três condições — domínio na
 * Vercel com certificado emitido, autorizado no Google, e na lista de
 * redirecionamento do Supabase.
 *
 * Fica aqui, e não some, porque é o caminho de volta: se algo der errado no
 * endereço novo, voltar para `false` devolve o app ao endereço antigo em uma
 * publicação, sem precisar desfazer nada nos painéis.
 */
const LIGAR_DOMINIO_NOVO = true;

/** O canônico de hoje. */
const HOST_CANONICO = LIGAR_DOMINIO_NOVO ? HOST_NOVO : HOST_ANTIGO;

/**
 * Cada domínio tem a sua forma sem `www`, e é dela que a pessoa precisa ser
 * tirada — mesmo no domínio que ainda não é o canônico, porque enquanto os
 * dois estiverem no ar os dois precisam ter login funcionando.
 */
const SEM_WWW: Record<string, string> = {
  "procuroapp.com.br": "www.procuroapp.com.br",
  "buscaitabirito.com.br": "www.buscaitabirito.com.br",
};

export function irParaEnderecoCanonico(): boolean {
  if (typeof window === "undefined") return false;

  const { hostname, pathname, search, hash } = window.location;

  // Endereço sem www: sobe para o www do mesmo domínio.
  const comWww = SEM_WWW[hostname];
  if (comWww) {
    window.location.replace(`https://${comWww}${pathname}${search}${hash}`);
    return true;
  }

  // Domínio antigo depois da virada: leva para o novo, uma vez só. Com a
  // chave desligada isto não acontece, porque HOST_CANONICO é o próprio
  // antigo — e é assim que se volta atrás sem mexer em painel nenhum.
  if (hostname === HOST_ANTIGO && HOST_CANONICO !== HOST_ANTIGO) {
    window.location.replace(`https://${HOST_CANONICO}${pathname}${search}${hash}`);
    return true;
  }

  return false;
}

/**
 * Endereço a usar como base do retorno do login.
 *
 * Não é `window.location.origin` de propósito: se a pessoa abriu o app pelo
 * endereço sem www e o desvio acima ainda não tiver acontecido, o retorno
 * seria pedido para o endereço errado — e o login quebraria de novo, agora
 * sem ninguém para consertar no meio do caminho.
 *
 * Durante a transição o retorno é o `www` do domínio em que a pessoa está, e
 * não o canônico global: quem entrar pelo endereço antigo tem que voltar do
 * Google para o endereço antigo, senão o login quebra justamente para quem
 * ainda não migrou.
 */
export function origemCanonica(): string {
  if (typeof window === "undefined") return `https://${HOST_CANONICO}`;
  const { hostname, origin } = window.location;
  const comWww = SEM_WWW[hostname];
  if (comWww) return `https://${comWww}`;
  return origin;
}
