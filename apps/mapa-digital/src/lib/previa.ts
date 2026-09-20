/**
 * Se isto está rodando como prévia publicada (montada com VITE_PREVIA=1) em
 * vez de como o app de verdade.
 *
 * Duas coisas mudam, e as duas por limite da hospedagem da prévia, não por
 * decisão de produto:
 *
 * 1. os endereços ganham `#`, porque lá recarregar em /pilar/1/... daria
 *    "página não encontrada";
 * 2. os botões de baixar arquivo somem, porque lá a página não tem permissão
 *    para entregar arquivo — o toque simplesmente não faria nada, que é o
 *    pior jeito de um botão falhar.
 */
export const EH_PREVIA = import.meta.env.VITE_PREVIA === "1";
