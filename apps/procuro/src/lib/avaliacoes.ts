/**
 * Avaliações e reputação.
 *
 * A regra que sustenta tudo mora no banco (migration 0006): **só avalia
 * quem teve um pedido aceito por aquele profissional**, e o vínculo é
 * chave estrangeira, não conferência do app. Aqui só se lê e se escreve.
 */

import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import type { Avaliacao, Reputacao } from '../tipos/dominio';

export async function reputacaoDe(profissionalId: string): Promise<Reputacao | null> {
  const { data, error } = await supabase
    .from('reputacao')
    .select('*')
    .eq('profissional_id', profissionalId)
    .maybeSingle();

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar a reputação.'), error);
  }
  // Nulo aqui é "ainda não tem avaliação", que é diferente de falha — e a
  // tela precisa dizer "ainda sem avaliações", não "erro".
  return (data as Reputacao | null) ?? null;
}

export async function avaliacoesDe(
  profissionalId: string,
  limite = 20,
): Promise<Avaliacao[]> {
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, profissional_id, autor_id, nota, comentario, resposta, criada_em, editada_em, perfis!avaliacoes_autor_id_fkey ( nome )')
    .eq('profissional_id', profissionalId)
    .order('criada_em', { ascending: false })
    .limit(limite);

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar as avaliações.'), error);
  }

  return (data ?? []).map((l: Record<string, any>) => ({
    id: l.id,
    profissional_id: l.profissional_id,
    autor_id: l.autor_id,
    autor_nome: l.perfis?.nome ?? 'Cliente',
    nota: l.nota,
    comentario: l.comentario,
    resposta: l.resposta,
    criada_em: l.criada_em,
    editada_em: l.editada_em,
  }));
}

/**
 * Avaliar.
 *
 * O `disparoId` é o passaporte: é ele que prova que houve contato. O app
 * não escolhe o autor nem o profissional — o gatilho do banco os deduz do
 * pedido, e descarta o que vier escrito.
 */
export async function avaliar(dados: {
  disparoId: string;
  nota: number;
  comentario?: string;
}): Promise<void> {
  if (dados.nota < 1 || dados.nota > 5) {
    throw new ErroDeDados('Escolha de 1 a 5 estrelas.');
  }

  const { error } = await supabase.from('avaliacoes').insert({
    disparo_id: dados.disparoId,
    // Estes dois vão porque as colunas são `not null`, mas o gatilho os
    // reescreve a partir do pedido. Mandar o valor certo aqui é cortesia,
    // não é o que garante a verdade.
    profissional_id: '00000000-0000-0000-0000-000000000000',
    autor_id: '00000000-0000-0000-0000-000000000000',
    nota: dados.nota,
    comentario: dados.comentario?.trim() || null,
  });

  if (error) {
    const codigo = (error as { code?: string }).code;
    if (codigo === '23505') {
      throw new ErroDeDados('Você já avaliou este atendimento.', error);
    }
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para enviar sua avaliação.'), error);
  }
}

/** A resposta do profissional a uma avaliação que recebeu. */
export async function responderAvaliacao(id: string, resposta: string): Promise<void> {
  const texto = resposta.trim();
  if (texto.length < 3) throw new ErroDeDados('Escreva sua resposta.');

  const { data, error } = await supabase
    .from('avaliacoes')
    .update({ resposta: texto, respondida_em: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para enviar sua resposta.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados('Não deu para responder: esta conta não tem permissão.');
  }
}

/** Denunciar. */
export async function denunciar(dados: {
  alvoId: string;
  motivo: 'nao_atendeu' | 'cobranca_indevida' | 'desrespeito' | 'perfil_falso' | 'servico_mal_feito' | 'outro';
  detalhe?: string;
}): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) throw new ErroDeDados('Você precisa entrar para denunciar.');

  const { error } = await supabase.from('denuncias').insert({
    autor_id: meuId,
    alvo_id: dados.alvoId,
    motivo: dados.motivo,
    detalhe: dados.detalhe?.trim() || null,
  });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ErroDeDados('Você já denunciou esta pessoa e estamos analisando.', error);
    }
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para enviar a denúncia.'), error);
  }
}

/** Bloquear — decisão pessoal, efeito imediato no disparo. */
export async function bloquear(alvoId: string, motivo?: string): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) throw new ErroDeDados('Você precisa entrar para bloquear.');

  const { error } = await supabase.from('bloqueios').insert({
    de_id: meuId,
    para_id: alvoId,
    motivo: motivo?.trim() || null,
  });

  if (error && (error as { code?: string }).code !== '23505') {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para bloquear.'), error);
  }
}

export const MOTIVOS_DE_DENUNCIA = [
  { valor: 'nao_atendeu' as const, texto: 'Aceitou e não apareceu' },
  { valor: 'cobranca_indevida' as const, texto: 'Cobrança indevida' },
  { valor: 'servico_mal_feito' as const, texto: 'Serviço mal feito' },
  { valor: 'desrespeito' as const, texto: 'Desrespeito ou ameaça' },
  { valor: 'perfil_falso' as const, texto: 'Perfil falso' },
  { valor: 'outro' as const, texto: 'Outro motivo' },
];
