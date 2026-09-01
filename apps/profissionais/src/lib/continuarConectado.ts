/**
 * "Continuar conectado neste aparelho" — a escolha de quem entra.
 *
 * ── Por que isto existe, e por que NÃO é "gravar a senha" ────────────
 * O pedido original foi "ter opção de gravar a senha na tela de início".
 * Só que neste app não há senha para gravar: entra-se por código de SMS
 * ou pelo Google. O que a pessoa quer de verdade é não ter que fazer
 * tudo de novo toda vez que abre o app — e isso se resolve pela sessão,
 * não pela senha.
 *
 * Guardar senha em qualquer canto que o app controle seria pior em todos
 * os sentidos: o navegador já faz isso melhor (chaveiro do aparelho,
 * protegido por digital), e uma senha guardada por nós é uma senha que
 * pode vazar por nossa causa.
 *
 * ── O que a escolha muda ─────────────────────────────────────────────
 * Marcada (o padrão): a sessão vai para o `localStorage` e sobrevive a
 * fechar o app. A pessoa volta dias depois e já está dentro.
 *
 * Desmarcada: a sessão vai para o `sessionStorage` e morre quando a aba
 * fecha. É o que serve para quem está num computador emprestado ou numa
 * lan house — e em Itabirito isso não é hipótese.
 *
 * O padrão é marcado porque a esmagadora maioria entra do próprio
 * celular, e para essas pessoas pedir login de novo é só estorvo.
 */

const CHAVE = "ei.continuar-conectado";

/** A escolha atual. Sem escolha registrada, é `true`. */
export function continuarConectado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    /* Aba anônima com armazenamento bloqueado. Responder `true` aqui é
       seguro: o `localStorage` que também vai falhar lá adiante faz a
       sessão morrer sozinha ao fechar, que é justamente o que a resposta
       `false` pediria. */
    return true;
  }
}

/** Registra a escolha. Chamada pela tela de entrada, ANTES de entrar. */
export function definirContinuarConectado(valor: boolean): void {
  try {
    localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    /* Sem onde guardar a preferência, o app continua funcionando — só não
       lembra dela. Não é motivo para derrubar a tela de login. */
  }
}
