import { lerLadoDaSessao } from "./ladoDaSessao";

import { LOGIN_TELEFONE_ATIVO } from "../config";

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

/**
 * O login do Google serve neste lugar?
 *
 * Dentro do app instalado, NÃO — e o motivo é mecânico, não de gosto. O
 * Google recusa fazer login dentro da tela do próprio app (é regra dele,
 * contra golpe de tela falsa), então ele abre no navegador do celular. De
 * lá, voltar para dentro do app exige uma ponte: um endereço próprio do
 * app, registrado no Android, autorizado no Google Cloud e no Supabase.
 * Essa ponte não existe neste projeto. Quem tocar no botão entra no
 * Google, e fica no navegador — a conta é criada e o app continua pedindo
 * login, sem nada explicando por quê.
 *
 * Por isso o botão some no app da loja. MAS há uma trava, e ela é o
 * ponto importante desta função:
 *
 *   ele só some se existir outra porta de entrada.
 *
 * O login por telefone depende de uma configuração ligada fora do código
 * (ver LOGIN_TELEFONE_ATIVO). Se alguém publicar o app com ela desligada e
 * o Google escondido, o resultado é um aplicativo em que NÃO É POSSÍVEL
 * entrar de jeito nenhum — pior que o botão que não volta, porque o botão
 * quebrado ao menos denuncia o problema, e a tela sem botão nenhum parece
 * de propósito.
 *
 * Então, sem a outra porta, o Google fica. Um caminho ruim é melhor que
 * caminho nenhum, e o defeito aparece em vez de se esconder.
 */
export function googleServeAqui(): boolean {
  if (!ehAppDaLoja()) return true;
  return !LOGIN_TELEFONE_ATIVO;
}

/**
 * Este anúncio é do lado de quem está olhando?
 *
 * ── O pedido — 05/09 ──────────────────────────────────────────────────
 *
 * A dona: "o anúncio de destaque da vaga não tem que aparecer no ambiente
 * do profissional e nem o do destaque do profissional aparecer no da
 * empresa."
 *
 * Estava trocado nos dois lugares, e trocado de um jeito que só se vê
 * quando alguém percorre o app pelo lado certo:
 *
 * - No BANCO DE TALENTOS, que é onde a EMPRESA procura gente, a pastilha
 *   "Apareça aqui" levava a `/destaque` — que vende o destaque do
 *   PROFISSIONAL. A empresa lia um convite para pagar por um lugar numa
 *   lista onde ela nunca vai estar.
 * - No BANCO DE VAGAS, que é onde a PESSOA procura emprego, a mesma
 *   pastilha levava a `/destaque-da-vaga` — que vende o destaque de uma
 *   VAGA, coisa que só quem anuncia tem.
 *
 * Cada anúncio tem o lugar dele, e os dois já existem: o do profissional
 * em "Meu desempenho", o da vaga no painel da própria vaga. O que faltava
 * era não oferecê-los para quem não pode comprar.
 *
 * `null` (ninguém escolheu lado ainda — visita de fora, sem login) também
 * é "não": as duas listas são abertas, e quem chega pelo Google a um banco
 * de talentos está procurando gente, não se oferecendo.
 */
export function vendendoPara(lado: "professional" | "company"): boolean {
  return podeVender() && lerLadoDaSessao() === lado;
}
