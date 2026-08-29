/**
 * A conta de quem está usando, e o cadastro de profissional.
 *
 * Uma decisão que atravessa o app inteiro: **cliente e profissional são a
 * mesma conta.** Não existe "criar conta de profissional" — existe uma
 * pessoa que, em algum momento, cadastra o que faz. Quem contrata hoje
 * pode passar a atender amanhã sem começar de novo, e quem atende continua
 * podendo contratar.
 *
 * A alternativa (dois cadastros, dois logins) parece organizada no papel e
 * na prática cria a pessoa que tem duas contas com o mesmo telefone e não
 * lembra em qual está o histórico.
 */

import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import type { Perfil, Situacao, TipoDeCadastro } from '../tipos/dominio';

/** Quem está logado. */
export async function meuPerfil(): Promise<Perfil | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) return null;

  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, telefone, telefone_confirmado, foto_url, cidade_id, aceitou_termos_em')
    .eq('id', meuId)
    .maybeSingle();

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar seus dados.'), error);
  }
  return (data as Perfil | null) ?? null;
}

/**
 * Salvar o nome e a cidade.
 *
 * É `update`, nunca `upsert`. O `upsert` do PostgREST é um
 * `insert ... on conflict`, então passa pela policy de INSERT mesmo
 * editando uma linha que já existe — e como a linha de perfil é criada
 * pelo gatilho da conta (0004), não há policy de insert. O upsert seria
 * recusado sem explicar por quê.
 */
export async function salvarPerfil(dados: {
  nome: string;
  cidadeId?: string | null;
}): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) throw new ErroDeDados('Você precisa entrar para salvar seus dados.');

  const nome = dados.nome.trim();
  if (nome.length < 2) throw new ErroDeDados('Escreva seu nome completo.');

  const { data, error } = await supabase
    .from('perfis')
    .update({ nome, cidade_id: dados.cidadeId ?? null })
    .eq('id', meuId)
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para salvar seus dados.'), error);
  }
  // Sem linha de volta a gravação não aconteceu, mesmo sem erro — é assim
  // que o RLS recusa: filtrando em silêncio.
  if (!data || data.length === 0) {
    throw new ErroDeDados('Não deu para salvar: esta conta não tem permissão.');
  }
}

/**
 * O cadastro de profissional de quem está logado, se existir.
 *
 * `null` NÃO é erro: é o estado de todo mundo que usa o app só para
 * procurar. Falha de verdade continua lançando, para as duas coisas não
 * virarem a mesma resposta.
 */
export async function meuCadastro(): Promise<CadastroProfissional | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) return null;

  const { data, error } = await supabase
    .from('profissionais')
    .select(
      'id, categoria_id, cidade_id, tipo, apresentacao, raio_km, situacao, ausente_ate, documento_verificado_em, suspenso_em',
    )
    .eq('perfil_id', meuId)
    .maybeSingle();

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar seu cadastro.'), error);
  }
  return (data as CadastroProfissional | null) ?? null;
}

export type CadastroProfissional = {
  id: string;
  categoria_id: string;
  cidade_id: string;
  tipo: TipoDeCadastro;
  apresentacao: string | null;
  raio_km: number;
  situacao: Situacao;
  ausente_ate: string | null;
  documento_verificado_em: string | null;
  suspenso_em: string | null;
};

/**
 * Criar o cadastro de profissional.
 *
 * Aqui o `insert` é o certo, porque a linha realmente não existe ainda.
 */
export async function criarCadastro(dados: {
  categoriaId: string;
  cidadeId: string;
  tipo: TipoDeCadastro;
  apresentacao: string;
  raioKm: number;
}): Promise<string> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) throw new ErroDeDados('Você precisa entrar para se cadastrar.');

  const apresentacao = dados.apresentacao.trim();
  if (apresentacao.length < 20) {
    throw new ErroDeDados(
      'Escreva um pouco mais sobre o que você faz — pelo menos duas linhas. É esse texto que a pessoa lê antes de decidir chamar você.',
    );
  }

  const { data, error } = await supabase
    .from('profissionais')
    .insert({
      perfil_id: meuId,
      categoria_id: dados.categoriaId,
      cidade_id: dados.cidadeId,
      tipo: dados.tipo,
      apresentacao,
      raio_km: dados.raioKm,
    })
    .select('id')
    .single();

  if (error) {
    // Cadastro repetido tem recado próprio: "já está cadastrado" resolve,
    // "erro ao salvar" faz a pessoa tentar de novo para sempre.
    if ((error as { code?: string }).code === '23505') {
      throw new ErroDeDados('Você já tem um cadastro de profissional.', error);
    }
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para criar seu cadastro.'), error);
  }
  return (data as { id: string }).id;
}

/** Editar o cadastro. */
export async function salvarCadastro(
  id: string,
  dados: Partial<{
    categoriaId: string;
    apresentacao: string;
    raioKm: number;
  }>,
): Promise<void> {
  const mudancas: Record<string, unknown> = {};
  if (dados.categoriaId) mudancas.categoria_id = dados.categoriaId;
  if (dados.apresentacao !== undefined) mudancas.apresentacao = dados.apresentacao.trim();
  if (dados.raioKm !== undefined) mudancas.raio_km = dados.raioKm;
  if (Object.keys(mudancas).length === 0) return;

  const { data, error } = await supabase
    .from('profissionais')
    .update(mudancas)
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para salvar seu cadastro.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados('Não deu para salvar: esta conta não tem permissão.');
  }
}

/**
 * Trocar a disponibilidade.
 *
 * Os quatro estados existem porque são quatro decisões diferentes, e
 * juntá-las num interruptor "ligado/desligado" obrigaria quem está de
 * férias a sumir da busca — perdendo os clientes que voltariam depois.
 */
export async function mudarSituacao(
  id: string,
  situacao: Situacao,
  ausenteAte?: string | null,
): Promise<void> {
  // Férias sem data de volta é cadastro invisível para sempre, porque
  // ninguém lembra de destravar. A data é o que faz o app destravar sozinho.
  if (situacao === 'ferias' && !ausenteAte) {
    throw new ErroDeDados('Escolha até quando você fica de férias, para o app te trazer de volta sozinho.');
  }

  const { data, error } = await supabase
    .from('profissionais')
    .update({
      situacao,
      ausente_ate: situacao === 'ferias' ? ausenteAte : null,
    })
    .eq('id', id)
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para mudar sua disponibilidade.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados('Não deu para mudar: esta conta não tem permissão.');
  }
}
