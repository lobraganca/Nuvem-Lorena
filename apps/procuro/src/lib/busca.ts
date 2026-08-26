/**
 * Procurar quem faz.
 *
 * A ordenação NÃO mora aqui — mora na função `buscar_profissionais` do
 * banco. É de propósito: "quem paga aparece antes" é regra de negócio, e
 * regra de negócio espalhada pelo app diverge. A tela que esquecer de
 * aplicá-la vira a tela onde o plano pago não vale nada, e ninguém percebe
 * até um assinante reclamar que não aparece.
 *
 * Aqui só se pergunta e se traduz o que voltou.
 */

import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import type { Categoria, Cidade, ProfissionalPublico } from '../tipos/dominio';

export type FiltroDaBusca = {
  termo?: string;
  cidadeId?: string;
  categoriaId?: string;
  limite?: number;
};

/**
 * A busca.
 *
 * Falha lança, nunca devolve lista vazia — "nenhum profissional
 * encontrado" quando na verdade a busca quebrou é a mentira mais cara que
 * um app destes pode contar: a tela parece certa, ninguém reclama, e o
 * defeito vive meses.
 */
export async function buscar(filtro: FiltroDaBusca = {}): Promise<ProfissionalPublico[]> {
  const { data, error } = await supabase.rpc('buscar_profissionais', {
    p_termo: filtro.termo?.trim() || null,
    p_cidade_id: filtro.cidadeId ?? null,
    p_categoria_id: filtro.categoriaId ?? null,
    p_limite: filtro.limite ?? 50,
  });

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para fazer a busca agora.'), error);
  }
  return (data ?? []) as ProfissionalPublico[];
}

/** O catálogo de ofícios, para as fichas de categoria da tela. */
export async function categorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome, grupo, icone, ordem')
    .eq('ativa', true)
    .order('grupo')
    .order('ordem');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar as categorias.'), error);
  }
  return (data ?? []) as Categoria[];
}

export async function cidades(): Promise<Cidade[]> {
  const { data, error } = await supabase
    .from('cidades')
    .select('id, nome, uf, raio_padrao_km')
    .eq('ativa', true)
    .order('nome');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar as cidades.'), error);
  }
  return (data ?? []) as Cidade[];
}

/**
 * Agrupa as categorias por grupo, preservando a ordem que veio do banco.
 *
 * `Map` e não objeto: objeto em JavaScript reordena chaves que parecem
 * número, e "24 horas" viraria a primeira seção da tela sem ninguém
 * entender por quê.
 */
export function porGrupo(lista: Categoria[]): Map<string, Categoria[]> {
  const grupos = new Map<string, Categoria[]>();
  for (const c of lista) {
    const atual = grupos.get(c.grupo);
    if (atual) atual.push(c);
    else grupos.set(c.grupo, [c]);
  }
  return grupos;
}

/**
 * O que dizer sobre a disponibilidade de alguém, em português.
 *
 * Fica aqui porque três telas mostram isso, e frase repetida é frase que
 * diverge — uma diz "em férias", outra "de férias", e a terceira esquece
 * de dizer.
 */
export function comoEstaAgora(p: ProfissionalPublico): { texto: string; atende: boolean } {
  if (p.situacao === 'disponivel') return { texto: 'Disponível', atende: true };
  if (p.situacao === 'pausado') return { texto: 'Sem receber pedidos agora', atende: false };
  if (p.situacao === 'ferias') {
    if (!p.ausente_ate) return { texto: 'De férias', atende: false };
    const volta = new Date(p.ausente_ate);
    const dia = String(volta.getDate()).padStart(2, '0');
    const mes = String(volta.getMonth() + 1).padStart(2, '0');
    return { texto: `De férias até ${dia}/${mes}`, atende: false };
  }
  return { texto: '', atende: false };
}
