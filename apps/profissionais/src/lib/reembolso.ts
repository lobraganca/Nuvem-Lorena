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
  /* O que o pedido causou no plano (0124). Opcional porque a coluna é
     nova: pedido antigo não tem, e aí não há o que mostrar. */
  efeito?: EfeitoDoReembolso | null;
  created_at: string;
  company_id: string | null;
  subscription_id: string | null;
};

/**
 * O que o pedido CAUSOU no plano — 0124.
 *
 *   `encerrado_agora`    dentro dos 7 dias: plano desligado e vagas fora
 *                        do ar na hora (art. 49 do CDC)
 *   `ate_o_vencimento`   depois dos 7 dias: não renova, e vale até o fim
 *                        do mês pago
 *   `sem_plano`          não havia plano valendo; o pedido foi só gravado
 */
export type EfeitoDoReembolso = "encerrado_agora" | "ate_o_vencimento" | "sem_plano";

/**
 * Registra o pedido E encerra o plano, conforme o caso.
 *
 * ── POR QUE UMA FUNÇÃO DO BANCO, E NÃO TRÊS GRAVAÇÕES DAQUI — 06/09 ───
 *
 * A dona: "quero que faça tudo automático. Se a pessoa pedir reembolso
 * antes dos 7 dias, [encerra]; depois dos 7 dias, o plano se encerra no
 * vencimento do mês."
 *
 * Tudo isso mora em `pedir_reembolso`, no banco (0124), por três motivos
 * que o navegador não tem como cumprir:
 *
 *  1. quem conta os 7 dias tem de ser o banco. Feita aqui, a conta usaria
 *     o relógio do celular — e atrasar o relógio transformaria um
 *     cancelamento em arrependimento;
 *  2. ou grava tudo, ou não grava nada. Um pedido registrado com o plano
 *     ainda ligado (ou o contrário) é pior que qualquer um dos dois, e
 *     três chamadas daqui quebram no meio quando o 4G cai;
 *  3. desde a 0123 a empresa NÃO consegue mexer no próprio plano — foi
 *     assim que se fechou o buraco de alguém se dar o Ei Infinit. Este
 *     código roda como a empresa, então um `update` daqui seria desfeito
 *     em silêncio pelo gatilho. Quem tem direito é a função, e só ela.
 *
 * Devolve qual das portas foi usada, para a tela dizer o que acabou de
 * acontecer em vez de um "pedido enviado" que não conta metade.
 */
export async function pedirReembolso(entrada: {
  userId: string;
  motivo: string;
  contato?: string | null;
  companyId?: string | null;
  subscriptionId?: string | null;
}): Promise<EfeitoDoReembolso> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const { data, error } = await sb.rpc("pedir_reembolso", {
    p_motivo: entrada.motivo.trim(),
    p_contato: entrada.contato?.trim() || null,
    p_company_id: entrada.companyId ?? null,
  });
  if (error) throw error;
  /* Resposta estranha não vira caso inventado: `sem_plano` é o único que
     não promete nada sobre o plano, então é a queda segura. */
  return data === "encerrado_agora" || data === "ate_o_vencimento"
    ? data
    : "sem_plano";
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
