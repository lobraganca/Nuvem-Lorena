import { useSyncExternalStore } from "react";
import { assinar, ler, type Respostas } from "./guardar";

/**
 * As respostas, sempre atualizadas. Redesenha quem usa isto quando qualquer
 * campo é salvo — é o que mantém a barra de progresso andando enquanto a
 * pessoa digita, em vez de só ao trocar de tela.
 */
export function useRespostas(): Respostas {
  return useSyncExternalStore(assinar, ler, ler);
}
