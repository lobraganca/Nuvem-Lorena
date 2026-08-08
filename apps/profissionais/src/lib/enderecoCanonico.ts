/**
 * Um app, um endereço só.
 *
 * `buscaitabirito.com.br` e `www.buscaitabirito.com.br` são o mesmo site para
 * uma pessoa e dois sites diferentes para o navegador: sessão, dados
 * guardados e a senha temporária do login do Google ficam separados por
 * endereço, sem se enxergarem.
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
 */
const HOST_CANONICO = "www.buscaitabirito.com.br";
const HOST_ALTERNATIVO = "buscaitabirito.com.br";

export function irParaEnderecoCanonico(): boolean {
  if (typeof window === "undefined") return false;

  const { hostname, pathname, search, hash } = window.location;
  if (hostname !== HOST_ALTERNATIVO) return false;

  window.location.replace(`https://${HOST_CANONICO}${pathname}${search}${hash}`);
  return true;
}

/**
 * Endereço a usar como base do retorno do login.
 *
 * Não é `window.location.origin` de propósito: se a pessoa abriu o app pelo
 * endereço sem www e o desvio acima ainda não tiver acontecido, o retorno
 * seria pedido para o endereço errado — e o login quebraria de novo, agora
 * sem ninguém para consertar no meio do caminho.
 */
export function origemCanonica(): string {
  if (typeof window === "undefined") return `https://${HOST_CANONICO}`;
  if (window.location.hostname === HOST_ALTERNATIVO) return `https://${HOST_CANONICO}`;
  return window.location.origin;
}
