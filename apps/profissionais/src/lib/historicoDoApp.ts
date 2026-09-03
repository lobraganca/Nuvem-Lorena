/**
 * Por onde a pessoa passou DENTRO do app.
 *
 * ── Por que não dá para usar o histórico do navegador ─────────────────
 *
 * O "Voltar" da barra de baixo já foi `navegar(-1)` — um passo atrás no
 * histórico do navegador — e a dona viu o defeito: "quando volta, alguns
 * botões da tela anterior não estão funcionando". O motivo é que este app
 * RECARREGA a página inteira em dois momentos (a troca de lado e o
 * login), e a entrada que ficou no histórico foi desenhada com o estado
 * antigo. Voltar para ela traz uma tela do lado anterior, com botões que
 * apontam para onde a pessoa não está mais.
 *
 * A resposta a isso foi mandar o "Voltar" sempre para a tela inicial —
 * que resolve o defeito e cria outro, que a dona também viu: "o botão de
 * voltar está indo para a tela de início; tem que voltar à página
 * anterior do app, aquela que está na ordem".
 *
 * ── O que este arquivo faz ────────────────────────────────────────────
 *
 * Guarda a ordem das telas do APP, e não a do navegador. Voltar então é
 * uma navegação normal para o endereço anterior: a tela se monta do zero,
 * com o estado de agora, e não há tela velha para ressuscitar.
 *
 * Fica em `sessionStorage` para sobreviver às duas recargas de página que
 * são a origem do problema, e para morrer junto com a aba — a ordem das
 * telas é de uma visita, não da vida da pessoa.
 */

const CHAVE = "ei-por-onde-passei";
/** Vinte telas é mais do que qualquer caminho real, e não pesa nada. */
const TETO = 20;

function ler(): string[] {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    const lista = cru ? JSON.parse(cru) : [];
    return Array.isArray(lista) ? lista.filter((x) => typeof x === "string") : [];
  } catch {
    /* Aba anônima com armazenamento bloqueado, ou conteúdo estragado. Sem
       histórico o "Voltar" cai no destino de reserva, que é a tela
       inicial — o comportamento de antes, e não uma tela quebrada. */
    return [];
  }
}

function gravar(lista: string[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(lista.slice(-TETO)));
  } catch {
    /* segue sem guardar */
  }
}

/** Marca que a pessoa está nesta tela agora. */
export function passeiPor(caminho: string) {
  const lista = ler();
  /* Repetir a mesma tela não é andar: sem isto, um filtro que reescreve a
     URL (a busca do banco de vagas o faz a cada letra digitada) encheria
     a pilha, e "Voltar" apagaria uma letra por toque. */
  if (lista[lista.length - 1] === caminho) return;
  lista.push(caminho);
  gravar(lista);
}

/**
 * A tela anterior, tirando a de agora da pilha.
 *
 * Devolve `null` quando não há para onde voltar — app aberto direto num
 * link, primeira tela da visita —, e aí quem chama decide o destino.
 */
export function telaAnterior(): string | null {
  const lista = ler();
  /* Sai a tela ATUAL. A anterior também sai: quem chamou vai navegar
     para ela, e a navegação a empilha de novo — sem isto ela ficaria
     duas vezes na pilha e o segundo "Voltar" não sairia do lugar. */
  lista.pop();
  const anterior = lista.pop() ?? null;
  gravar(lista);
  return anterior;
}
