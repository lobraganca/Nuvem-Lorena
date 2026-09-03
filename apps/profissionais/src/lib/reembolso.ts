import { supabase } from "./supabase";
import { lerTudo } from "./lerTudo";

/**
 * O pedido de reembolso, com o motivo escrito pela pessoa.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "a pessoa ao pedir reembolso ter onde escrever o motivo, e isso
 * chegar pra mim no painel do administrador."
 *
 * ── O que havia antes ──────────────────────────────────────────────────
 *
 * Um link de WhatsApp. A pessoa saía do app e o pedido virava mais uma
 * conversa no celular da dona, no meio de outras trinta: sem lista, sem
 * data, sem como saber o que já tinha sido resolvido. E quem pede
 * reembolso costuma cancelar tudo em seguida — então dias depois nem dava
 * para reconstruir de qual assinatura se estava falando.
 *
 * ── Por que o motivo importa mais do que parece ────────────────────────
 *
 * Dentro dos 7 dias o dinheiro volta sem justificativa nenhuma (art. 49
 * do CDC), e isso não muda: o campo não é uma condição para receber de
 * volta. Ele existe porque cinco pedidos seguidos dizendo "achei que a
 * vaga ia sair na hora" é a informação mais valiosa que este app pode
 * receber — e ela hoje se perde na conversa.
 *
 * Erro SOBE em tudo aqui. Um pedido de reembolso que "deu certo" sem ter
 * sido gravado é a pior falha silenciosa possível: a pessoa fica
 * esperando resposta de um pedido que não existe.
 */

export type PedidoDeReembolso = {
  id: string;
  user_id: string;
  motivo: string;
  contato: string | null;
  status: "novo" | "lido" | "resolvido";
  observacao: string | null;
  created_at: string;
  company_id: string | null;
  subscription_id: string | null;
};

/** Registra o pedido. Quem pede é sempre a conta que está aberta. */
export async function pedirReembolso(entrada: {
  userId: string;
  motivo: string;
  contato?: string | null;
  companyId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const { error } = await sb.from("pedidos_reembolso").insert({
    user_id: entrada.userId,
    motivo: entrada.motivo.trim(),
    contato: entrada.contato?.trim() || null,
    company_id: entrada.companyId ?? null,
    subscription_id: entrada.subscriptionId ?? null,
  });
  if (error) throw error;
}

/** Os pedidos desta pessoa, para a tela poder dizer "seu pedido chegou". */
export async function meusPedidosDeReembolso(userId: string): Promise<PedidoDeReembolso[]> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb
    .from("pedidos_reembolso")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PedidoDeReembolso[];
}

/**
 * Todos os pedidos, para a administração.
 *
 * `lerTudo` porque a 0062 pôs teto de 200 linhas em qualquer consulta, e
 * uma lista de pedidos que para de crescer no ducentésimo é exatamente o
 * tipo de coisa que ninguém percebe.
 */
export async function pedidosDeReembolso(): Promise<PedidoDeReembolso[]> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  return (await lerTudo(() =>
    sb.from("pedidos_reembolso").select("*").order("created_at", { ascending: false })
  )) as PedidoDeReembolso[];
}

/**
 * Marca o pedido como lido ou resolvido, com uma anotação.
 *
 * `update`, nunca `upsert`: o `upsert` do PostgREST é um
 * `insert ... on conflict`, então passa pela policy de INSERT — que aqui
 * só deixa a própria pessoa gravar. A administração seria recusada
 * mexendo numa linha que ela tem permissão de mexer.
 */
export async function responderPedidoDeReembolso(
  id: string,
  status: "novo" | "lido" | "resolvido",
  observacao?: string
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const mudanca: Record<string, unknown> = { status };
  if (observacao !== undefined) mudanca.observacao = observacao.trim() || null;
  const { error } = await sb.from("pedidos_reembolso").update(mudanca).eq("id", id);
  if (error) throw error;
}
