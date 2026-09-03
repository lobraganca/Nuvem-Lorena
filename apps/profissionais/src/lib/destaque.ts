import { supabase } from "./supabase";

/**
 * O destaque de quem procura trabalho: 7 dias no topo da lista.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "vou fazer um plano pra quem quer aparecer na lista primeiro.
 * R$ 10,90 por 7 dias. Daí aparece profissional em alta e ele no topo das
 * vagas."
 *
 * ── Por que ESTE é o produto certo para quem procura trabalho ─────────
 *
 * A alternativa que ficou para trás era cobrar para ver quais vagas
 * combinam. Isso cobraria justamente de quem não tem os R$ 10 sobrando, e
 * derrubaria o número de candidatos — que é o que faz o app valer para a
 * empresa. Aparecer primeiro não tira nada de ninguém: as mesmas pessoas
 * continuam na lista, na mesma lista, com as mesmas informações.
 *
 * ── As colunas já existiam ─────────────────────────────────────────────
 *
 * `boosted` e `boosted_until` são da 0016, do outro produto, onde
 * turbinavam o anúncio de um prestador de serviço. Aqui elas ganham outro
 * uso e nenhuma migration: a régua é a mesma — "está no topo até tal
 * dia".
 */

/** 7 dias, R$ 10,90. O preço mora aqui, e não espalhado nas telas. */
export const DESTAQUE_DIAS = 7;
export const DESTAQUE_PRECO = 10.9;

export function precoDoDestaqueEmTexto(): string {
  return DESTAQUE_PRECO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Está em destaque AGORA?
 *
 * A data importa tanto quanto a marca: `boosted` continua ligado depois de
 * o prazo vencer (nada apaga a coluna sozinho), então olhar só para ela
 * deixaria alguém no topo para sempre por ter pago uma vez.
 */
export function destaqueValendo(p: {
  boosted?: boolean | null;
  boosted_until?: string | null;
}): boolean {
  if (!p.boosted) return false;
  if (!p.boosted_until) return true;
  return new Date(p.boosted_until).getTime() > Date.now();
}

/** Quantos dias ainda faltam, arredondando para cima. Zero = acabou. */
export function diasDeDestaqueRestantes(ate: string | null | undefined): number {
  if (!ate) return 0;
  const falta = new Date(ate).getTime() - Date.now();
  return falta > 0 ? Math.ceil(falta / 86_400_000) : 0;
}

/** O destaque deste cadastro, para a tela de quem procura trabalho. */
export async function meuDestaque(
  professionalId: string
): Promise<{ ativo: boolean; ate: string | null }> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb
    .from("professionals")
    .select("boosted, boosted_until")
    .eq("id", professionalId)
    .limit(1);
  if (error) throw error;
  const linha = (data ?? [])[0] as { boosted: boolean; boosted_until: string | null } | undefined;
  if (!linha) return { ativo: false, ate: null };
  return { ativo: destaqueValendo(linha), ate: linha.boosted_until };
}

/**
 * Liga o destaque por N dias. Só a administração consegue — quem decide é
 * o banco (as policies de admin em `professionals`, da 0008), não a tela.
 *
 * ── Por que soma a partir de AGORA, e não da data antiga ──────────────
 *
 * Quem está no fim do prazo e paga de novo quer 7 dias inteiros, e não 7
 * dias contados de onde parou. Somar ao que resta seria o certo se as duas
 * compras fossem seguidas — mas o caso comum aqui é a pessoa sumir por um
 * mês e voltar, e aí somar daria um prazo que já venceu.
 *
 * `update`, nunca `upsert`: o `upsert` do PostgREST passa pela policy de
 * INSERT, e a administração seria recusada mexendo numa linha que ela tem
 * permissão de mexer.
 */
export async function ligarDestaque(professionalId: string, dias = DESTAQUE_DIAS): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const ate = new Date(Date.now() + dias * 86_400_000).toISOString();
  const { error } = await sb
    .from("professionals")
    .update({ boosted: true, boosted_until: ate })
    .eq("id", professionalId);
  if (error) throw error;
  return ate;
}

/** Desliga na hora — para devolução, engano ou denúncia. */
export async function desligarDestaque(professionalId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { error } = await sb
    .from("professionals")
    .update({ boosted: false, boosted_until: null })
    .eq("id", professionalId);
  if (error) throw error;
}
