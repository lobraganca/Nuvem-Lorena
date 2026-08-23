/**
 * As oportunidades que chegam para quem atende, e o que ele faz com elas.
 *
 * A regra que vale para todas as funções deste arquivo:
 *
 *   **Falhou, lança. Nunca devolve lista vazia.**
 *
 * `catch { return [] }` é tentador porque a tela não quebra. E é exatamente
 * esse o problema: a tela não quebra, escreve "nenhuma oportunidade", e o
 * profissional acha que está um dia parado quando na verdade o app parou.
 * Ninguém reclama de uma tela que parece normal, então o defeito vive
 * meses. Quem falha aqui lança `ErroDeDados`, e a tela mostra o recado.
 */

import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import type { Oportunidade, Plano, RespostaAoDisparo } from '../tipos/dominio';

/**
 * O cadastro de profissional de quem está logado.
 *
 * Devolve `null` quando a pessoa entrou mas ainda não se cadastrou como
 * profissional — que é o estado de todo mundo que usa o app só para
 * procurar. `null` aqui NÃO é erro, é uma resposta legítima, e é por isso
 * que ele não lança: quem só contrata nunca vai ter essa linha.
 *
 * Falha de verdade (rede, permissão) continua lançando, para não virar o
 * mesmo `null` e esconder o problema.
 */
export async function meuCadastroProfissional(): Promise<{ id: string } | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const meuId = sessao.session?.user.id;
  if (!meuId) return null;

  const { data, error } = await supabase
    .from('profissionais')
    .select('id')
    .eq('perfil_id', meuId)
    .maybeSingle();

  if (error) {
    throw new ErroDeDados(
      mensagemDeErro(error, 'Não deu para carregar seu cadastro de profissional.'),
      error,
    );
  }
  return data ?? null;
}

/** As colunas do pedido que o cartão de oportunidade precisa. */
const CAMPOS = `
  id, pedido_id, profissional_id, onda,
  enviado_em, visto_em, respondido_em, resposta,
  pedido:pedidos!inner (
    id, cliente_id, categoria_id, cidade_id, descricao, bairro,
    tipo, status, expira_em, criado_em,
    categorias!inner ( nome ),
    perfis!inner ( nome )
  )
`;

type LinhaCrua = Record<string, any>;

/** Achata o que o PostgREST devolve aninhado para o formato que a tela usa. */
function paraOportunidade(linha: LinhaCrua): Oportunidade {
  const pedido = linha.pedido ?? {};
  return {
    id: linha.id,
    pedido_id: linha.pedido_id,
    profissional_id: linha.profissional_id,
    onda: linha.onda,
    enviado_em: linha.enviado_em,
    visto_em: linha.visto_em,
    respondido_em: linha.respondido_em,
    resposta: linha.resposta,
    pedido: {
      ...pedido,
      categoria_nome: pedido.categorias?.nome ?? '',
      cliente_nome: pedido.perfis?.nome ?? '',
    },
  };
}

/**
 * As oportunidades ainda sem resposta.
 *
 * Ordenadas pela mais recente. O pedido vencido não aparece: ele já não
 * pode ser aceito, e deixá-lo na lista só produz a frustração de responder
 * algo que já passou.
 */
export async function oportunidadesEmAberto(profissionalId: string): Promise<Oportunidade[]> {
  const { data, error } = await supabase
    .from('disparos')
    .select(CAMPOS)
    .eq('profissional_id', profissionalId)
    .is('respondido_em', null)
    .eq('pedido.status', 'aberto')
    .order('enviado_em', { ascending: false });

  if (error) {
    throw new ErroDeDados(
      mensagemDeErro(error, 'Não deu para carregar suas oportunidades.'),
      error,
    );
  }
  return (data ?? []).map(paraOportunidade);
}

/** O histórico: o que já foi aceito ou recusado. */
export async function oportunidadesRespondidas(
  profissionalId: string,
  limite = 50,
): Promise<Oportunidade[]> {
  const { data, error } = await supabase
    .from('disparos')
    .select(CAMPOS)
    .eq('profissional_id', profissionalId)
    .not('respondido_em', 'is', null)
    .order('respondido_em', { ascending: false })
    .limit(limite);

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para carregar seu histórico.'), error);
  }
  return (data ?? []).map(paraOportunidade);
}

/**
 * Aceitar ou recusar.
 *
 * É `update`, nunca `upsert`. O `upsert` do PostgREST é um
 * `insert ... on conflict`, então ele passa pela policy de **INSERT** mesmo
 * quando está só editando uma linha que já existe. Como o disparo não tem
 * policy de insert (quem cria disparo é o motor, com service_role), um
 * upsert aqui seria recusado — e a recusa vem sem explicar por quê. Esse
 * mesmo engano já impediu uma administração inteira de salvar cadastro
 * durante um dia.
 *
 * O `select()` no fim não é enfeite: sem ele, o PostgREST devolve sucesso
 * mesmo quando o RLS filtrou a linha e nada foi gravado. Com ele, linha
 * nenhuma de volta significa que a gravação não aconteceu — e aí dá para
 * dizer isso em vez de fingir que deu certo.
 */
export async function responder(
  disparoId: string,
  resposta: RespostaAoDisparo,
): Promise<void> {
  const { data, error } = await supabase
    .from('disparos')
    .update({ resposta, respondido_em: new Date().toISOString() })
    .eq('id', disparoId)
    .is('respondido_em', null) // quem já respondeu não responde de novo
    .select('id');

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para registrar sua resposta.'), error);
  }
  if (!data || data.length === 0) {
    throw new ErroDeDados(
      'Esta oportunidade já foi respondida ou não está mais disponível.',
    );
  }
}

/** Marca como vista, para o cliente saber que chegou. Falha em silêncio de propósito. */
export async function marcarComoVista(disparoId: string): Promise<void> {
  // Esta é a única função do arquivo que engole o erro, e por um motivo:
  // "foi visto" é informação secundária. Se ela falhar, a pessoa ainda
  // consegue ler e responder a oportunidade — interromper a tela com um
  // aviso sobre isso seria trocar um problema invisível por um estorvo.
  await supabase
    .from('disparos')
    .update({ visto_em: new Date().toISOString() })
    .eq('id', disparoId)
    .is('visto_em', null);
}

/**
 * O plano vigente de quem atende.
 *
 * Chama a função do banco em vez de ler uma coluna porque plano vence com
 * a passagem do tempo: uma coluna precisaria de alguém para atualizá-la, e
 * no intervalo o profissional continuaria com o que já não paga.
 *
 * Devolve `null` quando não há assinatura ativa — e `null` aqui quer dizer
 * Básico, que é justamente quem não recebe disparo.
 */
export async function planoVigente(profissionalId: string): Promise<Plano | null> {
  const { data, error } = await supabase
    .rpc('plano_vigente', { p_profissional_id: profissionalId })
    .maybeSingle();

  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para saber qual é o seu plano.'), error);
  }
  return (data as Plano | null) ?? null;
}

/**
 * Em que onda este plano recebe, em português, para mostrar na tela.
 *
 * Fica aqui e não na tela porque três telas diferentes precisam da mesma
 * frase, e frase repetida é frase que diverge.
 */
export function comoRecebeOportunidades(plano: Plano | null): string {
  if (!plano || plano.onda === null) {
    return 'Seu plano não recebe oportunidades. Seu cadastro aparece para quem procura.';
  }
  if (plano.onda === 1) {
    return 'Você recebe as oportunidades primeiro, assim que alguém publica.';
  }
  const espera =
    plano.atraso_minutos >= 60
      ? `${Math.round(plano.atraso_minutos / 60)}h`
      : `${plano.atraso_minutos} min`;
  return `Você recebe as oportunidades ${espera} depois de quem tem o plano acima.`;
}
