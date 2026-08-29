/**
 * Publicar o que se precisa, e acompanhar quem respondeu.
 *
 * Este é o lado de quem procura — a metade do sistema de ondas que faz a
 * outra metade existir. Sem pedido publicado, não há disparo, e o plano
 * pago não entrega nada.
 */

import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import type { Pedido, StatusDoPedido, TipoDePedido } from '../tipos/dominio';

/**
 * Quantos profissionais receberiam este pedido.
 *
 * Perguntado ANTES de publicar, e mostrado na tela. Existe porque publicar
 * um pedido e não receber resposta nenhuma é a pior experiência possível
 * para quem procura — e, sem este número, ela é uma surpresa. Com ele, a
 * pessoa sabe de antemão se vale a pena esperar ou se é melhor procurar na
 * lista, e não fica esperando um retorno que nunca vinha.
 */
export async function quantosReceberiam(
  categoriaId: string,
  cidadeId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('profissionais_publicos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', categoriaId)
    .eq('cidade_id', cidadeId)
    .eq('situacao', 'disponivel');

  if (error) {
    throw new ErroDeDados(
      mensagemDeErro(error, 'Não deu para saber quantos profissionais existem por aqui.'),
      error,
    );
  }
  return count ?? 0;
}

/** Publicar um pedido. A partir daqui o motor de ondas cuida do resto. */
export async function publicar(dados: {
  categoriaId: string;
  cidadeId: string;
  descricao: string;
  bairro?: string;
  tipo?: TipoDePedido;
  /** Quantas horas o pedido fica valendo. */
  horas?: number;
}): Promise<string> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) throw new ErroDeDados('Você precisa entrar para publicar um pedido.');

  const descricao = dados.descricao.trim();
  if (descricao.length < 10) {
    throw new ErroDeDados(
      'Explique um pouco melhor o que você precisa. Quanto mais claro, melhor a resposta que você recebe.',
    );
  }

  const horas = dados.horas ?? 48;
  const expira = new Date(Date.now() + horas * 3600_000).toISOString();

  const { data, error } = await supabase
    .from('pedidos')
    .insert({
      cliente_id: meuId,
      categoria_id: dados.categoriaId,
      cidade_id: dados.cidadeId,
      descricao,
      bairro: dados.bairro?.trim() || null,
      tipo: dados.tipo ?? 'proposta',
      expira_em: expira,
    })
    .select('id')
    .single();

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para publicar seu pedido.'), error);
  }
  return (data as { id: string }).id;
}

/**
 * Um pedido com o que aconteceu depois dele.
 *
 * As contagens vêm junto porque a tela sempre mostra as duas coisas, e
 * duas viagens de rede para desenhar um cartão é uma viagem a mais.
 */
export type MeuPedido = Pedido & {
  categoria_nome: string;
  /** Quantos profissionais receberam. */
  avisados: number;
  /** Quantos disseram que têm interesse. */
  interessados: number;
};

export async function meusPedidos(): Promise<MeuPedido[]> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) return [];

  const { data, error } = await supabase
    .from('pedidos')
    .select(
      `id, cliente_id, categoria_id, cidade_id, descricao, bairro, tipo, status,
       expira_em, criado_em,
       categorias!inner ( nome ),
       disparos ( id, resposta )`,
    )
    .eq('cliente_id', meuId)
    .order('criado_em', { ascending: false });

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar seus pedidos.'), error);
  }

  return (data ?? []).map((linha: Record<string, any>) => ({
    ...(linha as Pedido),
    categoria_nome: linha.categorias?.nome ?? '',
    avisados: Array.isArray(linha.disparos) ? linha.disparos.length : 0,
    interessados: Array.isArray(linha.disparos)
      ? linha.disparos.filter((d: { resposta?: string }) => d.resposta === 'aceito').length
      : 0,
  }));
}

/** Quem se interessou por um pedido, para o cliente escolher. */
export type Interessado = {
  disparoId: string;
  profissionalId: string;
  nome: string;
  telefone: string | null;
  categoriaNome: string;
  verificado: boolean;
  respondidoEm: string;
};

export async function interessadosNoPedido(pedidoId: string): Promise<Interessado[]> {
  const { data, error } = await supabase
    .from('disparos')
    .select(
      `id, profissional_id, respondido_em,
       profissionais!inner (
         id,
         perfis!inner ( nome, telefone, telefone_confirmado ),
         categorias!inner ( nome ),
         documento_verificado_em
       )`,
    )
    .eq('pedido_id', pedidoId)
    .eq('resposta', 'aceito')
    .order('respondido_em', { ascending: true }); // quem respondeu antes aparece antes

  if (error) {
    throw new ErroDeDados(
      mensagemDeErro(error, 'Não deu para carregar quem se interessou.'),
      error,
    );
  }

  return (data ?? []).map((l: Record<string, any>) => {
    const pro = l.profissionais ?? {};
    const perf = pro.perfis ?? {};
    return {
      disparoId: l.id,
      profissionalId: l.profissional_id,
      nome: perf.nome ?? '',
      // O mesmo cuidado da view pública: número só sai se foi confirmado
      // por código E continua sendo o número do cadastro.
      telefone:
        perf.telefone_confirmado && perf.telefone_confirmado === perf.telefone
          ? perf.telefone
          : null,
      categoriaNome: pro.categorias?.nome ?? '',
      verificado: !!pro.documento_verificado_em,
      respondidoEm: l.respondido_em,
    };
  });
}

/** Cancelar um pedido que já não vale. */
export async function cancelar(pedidoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('pedidos')
    .update({ status: 'cancelado' as StatusDoPedido })
    .eq('id', pedidoId)
    .eq('status', 'aberto')
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para cancelar o pedido.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados('Este pedido já não estava aberto.');
  }
}

/** Marcar como atendido — a porta de entrada para poder avaliar. */
export async function marcarComoAtendido(pedidoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('pedidos')
    .update({ status: 'atendido' as StatusDoPedido })
    .eq('id', pedidoId)
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para marcar como atendido.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados('Não deu para marcar: esta conta não tem permissão.');
  }
}

/** Em português, o que está acontecendo com o pedido. */
export function comoEsta(p: MeuPedido): { texto: string; cor: 'sucesso' | 'atencao' | 'neutra' } {
  if (p.status === 'cancelado') return { texto: 'Cancelado', cor: 'neutra' };
  if (p.status === 'atendido') return { texto: 'Atendido', cor: 'sucesso' };
  if (p.status === 'expirado') return { texto: 'Prazo encerrado', cor: 'neutra' };
  if (p.interessados > 0) {
    return {
      texto: `${p.interessados} ${p.interessados === 1 ? 'interessado' : 'interessados'}`,
      cor: 'sucesso',
    };
  }
  if (p.avisados > 0) {
    return { texto: `Avisamos ${p.avisados}, aguardando resposta`, cor: 'atencao' };
  }
  return { texto: 'Procurando profissionais', cor: 'atencao' };
}
