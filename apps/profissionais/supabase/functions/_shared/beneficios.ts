import type { TipoAssinatura } from "./precos.ts";

/**
 * Coluna de validade em `professionals` correspondente a cada assinatura.
 *
 * Estava declarada só dentro do webhook, e a rotina de renovação usava o
 * mesmo nome sem nunca tê-lo declarado. Isso passou despercebido porque o
 * trecho que a usa só roda quando existe alguém com plano à vista perto de
 * vencer — condição que nunca acontecia enquanto não havia assinante. A
 * primeira vez que aconteceu, a rotina inteira quebrou.
 *
 * Aqui é o lugar certo: quem precisar do mapa importa, e ninguém mais o
 * reescreve de memória.
 */
export const UNTIL_FIELD: Record<TipoAssinatura, string> = {
  verification: "verified_until",
  boost: "boosted_until",
  plus: "plus_until",
};
