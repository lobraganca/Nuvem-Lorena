/**
 * Um app, um endereço só.
 *
 * `empregoitabirito.com.br` e `www.empregoitabirito.com.br` são o mesmo site
 * para uma pessoa e dois sites diferentes para o navegador: sessão, dados
 * guardados e a senha temporária do login do Google ficam separados por
 * endereço, sem se enxergarem.
 *
 * É isso que quebra o login. Ele começa guardando um segredo e, na volta,
 * confere se bate. Começando em um endereço e terminando no outro, a
 * conferência falha e o Google devolve `error=invalid_request` — um erro que
 * parece de configuração e é, na verdade, de endereço.
 *
 * A troca acontece antes de o app desenhar qualquer coisa, para que nada
 * chegue a ser guardado no endereço errado. Caminho, filtros e o pedaço
 * depois do `#` (onde vem o token do login) são preservados inteiros — perder
 * o `#` aqui seria trocar um login quebrado por outro.
 *
 * ── Este arquivo apontava para o app errado ────────────────────────────────
 *
 * Ele veio da base de código do procurô e continuava com os endereços de lá:
 * o canônico era `www.procuroapp.com.br`, e havia uma migração de
 * `buscaitabirito.com.br` que é história daquele produto, não deste.
 *
 * Duas consequências reais, as duas invisíveis em teste:
 *
 * 1. Quem abrisse o Ei Emprego em `empregoitabirito.com.br` (sem o `www`)
 *    ficava lá, porque o endereço não estava na lista — e o login quebrava
 *    exatamente do jeito descrito acima, que é o defeito que este arquivo
 *    existe para não deixar acontecer.
 * 2. `origemCanonica()` respondia `www.procuroapp.com.br` fora do navegador,
 *    isto é, o retorno do login do Ei apontava para o site do outro app.
 */

/** Endereço oficial do app. É este que a publicação confere em `versao.json`. */
const HOST_CANONICO = "www.empregoitabirito.com.br";

/**
 * A forma sem `www`, que é de onde a pessoa precisa ser tirada.
 *
 * Fica num mapa, e não num `if`, porque é assim que um segundo domínio entra
 * um dia sem ninguém precisar reescrever a função — foi o que já aconteceu
 * uma vez, com o app que deu origem a este código.
 */
const SEM_WWW: Record<string, string> = {
  "empregoitabirito.com.br": "www.empregoitabirito.com.br",
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

  return false;
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
  const { hostname, origin } = window.location;
  const comWww = SEM_WWW[hostname];
  if (comWww) return `https://${comWww}`;
  return origin;
}
