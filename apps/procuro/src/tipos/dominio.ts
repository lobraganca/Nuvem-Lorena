/**
 * Os tipos do domínio, espelhando o banco.
 *
 * Escritos à mão em vez de gerados pelo CLI do Supabase de propósito: o
 * arquivo gerado descreve COLUNAS, e o que a tela precisa entender é
 * CONCEITO. `situacao: string` é o que o gerador dá; `Situacao` com os
 * quatro estados possíveis é o que impede alguém de escrever
 * `situacao === 'ferias '` com espaço e descobrir em produção.
 */

/** Em que pé está o cadastro de quem atende. */
export type Situacao =
  /** Aparece na busca e recebe oportunidade. */
  | 'disponivel'
  /** Aparece na busca, não recebe oportunidade — está ocupado hoje. */
  | 'pausado'
  /** Aparece marcado como ausente, não recebe. Volta sozinho na data. */
  | 'ferias'
  /** Sai da busca inteira, sem apagar o cadastro. */
  | 'oculto';

export const ROTULO_DA_SITUACAO: Record<Situacao, string> = {
  disponivel: 'Disponível',
  pausado: 'Oportunidades pausadas',
  ferias: 'De férias',
  oculto: 'Perfil oculto',
};

export type TipoDeCadastro = 'pf' | 'pj';
export type TipoDePedido = 'proposta' | 'orcamento';
export type StatusDoPedido = 'aberto' | 'atendido' | 'cancelado' | 'expirado';
export type RespostaAoDisparo = 'aceito' | 'recusado';

export type Cidade = {
  id: string;
  nome: string;
  uf: string;
  raio_padrao_km: number;
};

/** A conta de quem está usando — cliente e profissional são a mesma. */
export type Perfil = {
  id: string;
  nome: string;
  telefone: string | null;
  /**
   * O número que passou pelo código do SMS. Comparar com `telefone` é o
   * que impede confirmar um número e trocar por outro depois.
   */
  telefone_confirmado: string | null;
  foto_url: string | null;
  cidade_id: string | null;
  aceitou_termos_em: string | null;
};

/** A reputação, calculada na hora a partir das avaliações. */
export type Reputacao = {
  profissional_id: string;
  quantas: number;
  media: number;
  boas: number;
  ruins: number;
  media_recente: number | null;
};

export type Avaliacao = {
  id: string;
  profissional_id: string;
  autor_id: string;
  autor_nome: string;
  nota: number;
  comentario: string | null;
  resposta: string | null;
  criada_em: string;
  editada_em: string | null;
};

export type Categoria = {
  id: string;
  nome: string;
  grupo: string;
  icone: string | null;
  ordem: number;
};

/**
 * O plano, do jeito que o app precisa lê-lo.
 *
 * Repare que `onda` pode ser nula, e isso é o Básico: plano de consulta,
 * que aparece na busca e não recebe disparo nenhum. Deixar isso explícito
 * no tipo evita o `if (plano.onda)` que trata 0 e null igual.
 */
export type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal_centavos: number;
  preco_mensal_pj_centavos: number | null;
  /** Posição na fila de disparo. NULA = não recebe oportunidade. */
  onda: number | null;
  /** Quanto tempo depois do pedido esta onda sai. */
  atraso_minutos: number;
  whatsapp_liberado: boolean;
  ligacao_liberada: boolean;
  pedir_proposta: boolean;
  pedir_orcamento: boolean;
  chat_interno: boolean;
  estatisticas: boolean;
  divulgacao: boolean;
  destaque_busca: number;
  limite_oportunidades_abertas: number | null;
  ordem: number;
};

/** Um profissional como quem procura o enxerga (vem da view pública). */
export type ProfissionalPublico = {
  id: string;
  nome: string;
  foto_url: string | null;
  /** Só vem preenchido se a pessoa confirmou o número por código. */
  telefone: string | null;
  categoria_id: string;
  categoria_nome: string;
  categoria_grupo: string;
  cidade_id: string;
  cidade_nome: string;
  cidade_uf: string;
  tipo: TipoDeCadastro;
  apresentacao: string | null;
  situacao: Situacao;
  ausente_ate: string | null;
  verificado: boolean;
  raio_km: number;
  latitude: number | null;
  longitude: number | null;
  /**
   * O peso que o plano compra na ordenação da busca. Vem da view, calculado
   * a partir da assinatura vigente — quem deixa de pagar deixa de ter
   * destaque no mesmo instante, sem ninguém precisar passar atualizando
   * coluna.
   */
  destaque: number;
};

export type Pedido = {
  id: string;
  cliente_id: string;
  categoria_id: string;
  cidade_id: string;
  descricao: string;
  bairro: string | null;
  tipo: TipoDePedido;
  status: StatusDoPedido;
  expira_em: string;
  criado_em: string;
};

/**
 * Uma oportunidade que chegou para o profissional.
 *
 * É a linha de `disparos` com o pedido junto — porque a tela nunca mostra
 * uma sem a outra, e duas consultas para desenhar um cartão é uma consulta
 * a mais.
 */
export type Oportunidade = {
  id: string;
  pedido_id: string;
  profissional_id: string;
  onda: number;
  enviado_em: string;
  visto_em: string | null;
  respondido_em: string | null;
  resposta: RespostaAoDisparo | null;
  pedido: Pedido & {
    categoria_nome: string;
    cliente_nome: string;
  };
};
