/**
 * A tabela de preços do Ei Emprego — do lado do SERVIDOR.
 *
 * ── POR QUE ELA PRECISA EXISTIR AQUI, SE JÁ EXISTE NO APP ─────────────
 *
 * Porque o preço não pode vir da tela. Nunca.
 *
 * A tela também tem os preços (`src/types/domain.ts`, `PLANOS_EMPRESA`, e
 * `src/lib/destaque.ts`), e é de lá que sai o número que a empresa lê. Mas
 * o que a tela manda para a `criar-pagamento` é só a CHAVE do plano
 * ('pro', 'tres', ...). O valor cobrado sai daqui, de dentro do servidor,
 * onde ninguém alcança.
 *
 * Se o valor viesse na requisição, bastaria trocar um número nela para
 * assinar o Ei Máximo por um centavo — e a tela continuaria mostrando
 * R$ 129,90, então nem a pessoa que pagou nem a dona veriam nada estranho.
 * O primeiro lugar onde alguém mexe é esse.
 *
 * ── ISTO É UMA CÓPIA, E CÓPIA DE PREÇO É PERIGOSA ─────────────────────
 *
 * Uma Edge Function roda em Deno, no servidor do Supabase, e não consegue
 * importar `src/types/domain.ts` — são dois programas diferentes, em
 * máquinas diferentes. Então os números estão em dois lugares, e este
 * repositório já tem a cicatriz disso: `_shared/precos.ts` nasceu porque a
 * mesma tabela estava copiada em QUATRO arquivos, e bastava esquecer um
 * para o anual cobrar um valor e o mensal outro.
 *
 * Por isso existe `scripts/conferir-precos.mjs`, que compara este arquivo
 * com o `domain.ts` e RECUSA a montagem se um número divergir. Quem mexer
 * no preço mexe nos dois lugares — e descobre no mesmo minuto se esqueceu
 * de um, em vez de descobrir na fatura de quem pagou.
 */

export type TipoDePedido = "plano_empresa" | "destaque_profissional";

/** As chaves são as mesmas de `companies.plano` (ver a 0120). */
export type PlanoEmpresa = "pro" | "tres" | "cinco" | "dez" | "ilimitado";

/**
 * Quanto custa cada plano, em centavos, e o nome que vai na tela do
 * Mercado Pago.
 *
 * Em centavos pelo mesmo motivo do `domain.ts`: valor com vírgula em ponto
 * flutuante rende diferença de um centavo na hora de cobrar, e essa é a
 * diferença que o cliente percebe.
 *
 * O `ilimitado` NÃO está aqui, de propósito: ele é sob consulta, combinado
 * caso a caso. Um número inventado viraria cobrança de verdade.
 */
export const PLANOS: Record<Exclude<PlanoEmpresa, "ilimitado">, { nome: string; centavos: number }> = {
  pro: { nome: "Ei Conecta", centavos: 2990 },
  tres: { nome: "Ei Onda", centavos: 5990 },
  cinco: { nome: "Ei Impulso", centavos: 8990 },
  dez: { nome: "Ei Máximo", centavos: 12990 },
};

/** Quantos dias o plano pago vale. O mesmo `DIAS_ANUNCIO_VAGA` da tela. */
export const DIAS_DO_PLANO = 30;

/** O destaque de quem procura emprego: 7 dias no topo, R$ 10,90. */
export const DESTAQUE = { nome: "Aparecer primeiro por 7 dias", centavos: 1090, dias: 7 };

export function ehPlanoCobravel(chave: string): chave is Exclude<PlanoEmpresa, "ilimitado"> {
  return chave === "pro" || chave === "tres" || chave === "cinco" || chave === "dez";
}
