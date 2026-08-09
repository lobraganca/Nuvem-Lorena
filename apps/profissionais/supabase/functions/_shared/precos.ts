/**
 * Tabela de preços — uma só, para as quatro Edge Functions de cobrança.
 *
 * Ela estava copiada em quatro arquivos. Copiada, uma tabela de preço não
 * sobrevive à primeira mudança: bastava esquecer um deles para o anual
 * cobrar um valor e o mensal outro, ou para a renovação usar o preço velho —
 * e um erro desses só aparece na fatura de quem pagou.
 */

export type TipoAssinatura = "verification" | "boost" | "plus";
export type TipoDePessoa = "pf" | "pj";

/**
 * A conta premium custa diferente para pessoa e para empresa.
 *
 * Não é cobrar mais de quem pode pagar mais, é cobrar proporcional ao que
 * cada um leva: a empresa aparece com logo, responsável, endereço e catálogo
 * de serviços, e usa o app como canal de venda. O autônomo usa como agenda.
 *
 * O valor vem SEMPRE do `entity_type` guardado no banco, nunca de algo
 * enviado pela tela. Se o preço viesse do cliente, bastaria trocar um campo
 * na requisição para uma empresa assinar pelo preço de pessoa física.
 */
export const PRECOS_MENSAIS: Record<TipoAssinatura, Record<TipoDePessoa, number>> = {
  verification: { pf: 10.9, pj: 19.9 },
  boost: { pf: 19.9, pj: 19.9 },
  plus: { pf: 29.9, pj: 29.9 },
};

export const ROTULOS: Record<TipoAssinatura, string> = {
  verification: "conta premium",
  boost: "turbinar anúncio",
  plus: "Empresa Plus",
};

export function ehTipoValido(tipo: string): tipo is TipoAssinatura {
  return tipo === "verification" || tipo === "boost" || tipo === "plus";
}

export function precoMensal(tipo: TipoAssinatura, pessoa: TipoDePessoa): number {
  return PRECOS_MENSAIS[tipo][pessoa];
}

/** Anual à vista: 12x o mensal com 20% de desconto. */
export function precoAnual(tipo: TipoAssinatura, pessoa: TipoDePessoa): number {
  return Number((precoMensal(tipo, pessoa) * 12 * 0.8).toFixed(2));
}
