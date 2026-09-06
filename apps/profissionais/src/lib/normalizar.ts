/**
 * Deixa dois textos comparáveis: minúscula, sem acento, sem sobra nas
 * pontas.
 *
 * ── Por que mora sozinho num arquivo — 06/09 ──────────────────────────
 *
 * Ele era exportado por `compatibilidade.ts`, onde nasceu. Quando
 * `sinonimosDeOficio.ts` passou a precisar dele, as duas peças ficaram
 * importando uma da outra — e importação em círculo é o tipo de coisa
 * que funciona hoje (por causa de detalhe de ordem de carregamento) e
 * quebra no dia em que alguém trocar um `function` por um `const`, com
 * um erro que não aponta para a causa.
 *
 * Um arquivo de uma função só resolve, e diz a verdade: normalizar texto
 * não é assunto de compatibilidade nem de sinônimos, é assunto dos dois.
 *
 * `compatibilidade.ts` continua reexportando, para as telas que já o
 * importam de lá não precisarem mudar.
 */
export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    /* Tira o acento. Sem isto "atendimento a domicílio" e "atendimento a
       domicilio" são duas coisas diferentes para o computador, e são a
       mesma para todo mundo que digitou. */
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
