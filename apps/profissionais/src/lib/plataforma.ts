/**
 * Onde este código está rodando: no site ou dentro do app instalado pela
 * Play Store.
 *
 * Existe por uma regra da Google, não por gosto. Um app distribuído pela
 * Play Store não pode vender bem digital por fora da cobrança dela — e
 * "vender por fora" inclui mostrar o preço na tela e mandar a pessoa pagar
 * em outro lugar. É justamente o que o procurô faz hoje, e faz certo: o
 * plano é vendido pelo Mercado Pago.
 *
 * No site isso continua valendo e nada muda. Dentro do app da loja, as
 * telas que vendem simplesmente não existem — que é o estado mais conforme
 * possível, porque um app que não oferece compra nenhuma não tem o que
 * violar. Quem quiser assinar continua assinando pelo site, e o benefício
 * aparece no app sozinho: ele mora no banco, ligado à conta, e o app só
 * lê. Não há nada a sincronizar.
 *
 * O que o app NÃO pode fazer, e por isso não faz em lugar nenhum: dizer
 * "assine no procuroapp.com.br". Convidar para pagar fora é a violação.
 * Esconder é permitido; apontar o caminho não é.
 *
 * ---
 *
 * A detecção lê `window.Capacitor`, e não importa `@capacitor/core`, de
 * propósito: o pacote do site não deve carregar biblioteca nativa para
 * responder uma pergunta que no site é sempre "não". O Capacitor publica
 * esse objeto dentro do app instalado; no navegador ele não existe, e a
 * resposta é `false` sem nenhum peso a mais.
 *
 * As três interrogações não são exagero. `window` pode não existir
 * (montagem do pacote), `Capacitor` pode não existir (site), e
 * `isNativePlatform` pode não existir (versão antiga do embrulho). Cada
 * uma dessas ausências viraria um erro que derruba a tela inteira, e a
 * tela que derrubaria é a de busca.
 */
declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export function ehAppDaLoja(): boolean {
  if (typeof window === "undefined") return false;
  return window.Capacitor?.isNativePlatform?.() === true;
}

/**
 * O inverso, com nome que se lê bem no JSX: `{podeVender() && (...)}`.
 *
 * Vale a indireção porque o motivo fica no nome. `!ehAppDaLoja()` numa
 * tela de assinatura obriga quem lê a lembrar por que a loja importa ali;
 * `podeVender()` já diz.
 */
export function podeVender(): boolean {
  return !ehAppDaLoja();
}
