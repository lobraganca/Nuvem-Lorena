/**
 * Um banco de mentira, para ver e exercitar o app sem credencial nenhuma.
 *
 * Este arquivo existe para acabar com um hábito perigoso: trocar o
 * `supabase.ts` de verdade por um falso à mão, rodar, e lembrar de
 * desfazer. Funciona até a vez em que alguém esquece — e aí o app publicado
 * fala com um banco que não existe, sem erro nenhum, mostrando dados
 * inventados. É um defeito silencioso e caríssimo.
 *
 * Agora não há troca: quem escolhe é a variável `EXPO_PUBLIC_DEMO`. Sem
 * ela, este arquivo nunca é usado. Não dá para esquecer de desfazer uma
 * coisa que não foi feita.
 *
 * O que ele imita é só o suficiente para as telas funcionarem: a cadeia
 * `from().select().eq()...`, o `rpc()`, e o `auth` com uma sessão que
 * começa vazia — para dar para percorrer o caminho inteiro, do login às
 * oportunidades.
 */

const agora = Date.now();
const emMin = (m: number) => new Date(agora + m * 60000).toISOString();
const haMin = (m: number) => new Date(agora - m * 60000).toISOString();

const CATEGORIAS = [
  ['Eletricista', 'Casa e obra'], ['Encanador', 'Casa e obra'],
  ['Pedreiro', 'Casa e obra'], ['Pintor', 'Casa e obra'],
  ['Marceneiro', 'Casa e obra'], ['Chaveiro', 'Casa e obra'],
  ['Diarista', 'Casa e obra'], ['Jardineiro', 'Casa e obra'],
  ['Refrigeração e ar-condicionado', 'Técnica e conserto'],
  ['Mecânico', 'Técnica e conserto'], ['Técnico em celulares', 'Técnica e conserto'],
  ['Lavagem de carros', 'Técnica e conserto'],
  ['Cabeleireiro', 'Beleza e bem-estar'], ['Manicure e pedicure', 'Beleza e bem-estar'],
  ['Massagista', 'Beleza e bem-estar'], ['Nutricionista', 'Beleza e bem-estar'],
  ['Confeiteira', 'Festa e alimentação'], ['Salgadeira', 'Festa e alimentação'],
  ['Fotógrafo', 'Festa e alimentação'],
].map(([nome, grupo], i) => ({ id: 'c' + i, nome, grupo, icone: null, ordem: i * 10 }));

const CIDADES = [{ id: 'i1', nome: 'Itabirito', uf: 'MG', raio_padrao_km: 15 }];

const comum = {
  categoria_id: 'c0', categoria_nome: 'Eletricista', categoria_grupo: 'Casa e obra',
  cidade_id: 'i1', cidade_nome: 'Itabirito', cidade_uf: 'MG',
  tipo: 'pf', foto_url: null, latitude: null, longitude: null, ausente_ate: null,
};

/** Quatro perfis que cobrem os casos que a tela precisa saber desenhar. */
const PROFISSIONAIS = [
  { ...comum, id: 'p1', nome: 'Carlos Andrade', telefone: '+5531988887777',
    apresentacao: 'Instalação e manutenção elétrica residencial e comercial. Atendo emergência, inclusive fim de semana.',
    situacao: 'disponivel', verificado: true, raio_km: 15, destaque: 30 },
  { ...comum, id: 'p2', nome: 'Marcia Ferreira', telefone: '+5531977776666',
    apresentacao: 'Reparos rápidos, troca de fiação e quadros de luz.',
    situacao: 'disponivel', verificado: true, raio_km: 12, destaque: 10 },
  { ...comum, id: 'p3', nome: 'José Pinheiro', telefone: '+5531966665555',
    apresentacao: 'Atendo Itabirito e região há 20 anos.',
    situacao: 'disponivel', verificado: false, raio_km: 20, destaque: 0 },
  { ...comum, id: 'p4', nome: 'Rita Camargo', telefone: '+5531955554444',
    apresentacao: 'Quadros de luz e automação residencial.',
    situacao: 'ferias', ausente_ate: '2026-09-14', verificado: true, raio_km: 15, destaque: 30 },
];

const DISPAROS: any[] = [
  { id: 'd1', pedido_id: 'q1', profissional_id: 'pro-1', onda: 1, enviado_em: haMin(4),
    visto_em: null, respondido_em: null, resposta: null,
    pedido: { id: 'q1', cliente_id: 'u1', categoria_id: 'c0', cidade_id: 'i1',
      descricao: 'A tomada da cozinha parou de funcionar e está cheirando a queimado. Preciso de alguém ainda hoje se for possível.',
      bairro: 'Praia', tipo: 'proposta', status: 'aberto', expira_em: emMin(44), criado_em: haMin(4),
      categorias: { nome: 'Eletricista' }, perfis: { nome: 'Joana' } } },
  { id: 'd2', pedido_id: 'q2', profissional_id: 'pro-1', onda: 1, enviado_em: haMin(38),
    visto_em: null, respondido_em: null, resposta: null,
    pedido: { id: 'q2', cliente_id: 'u2', categoria_id: 'c0', cidade_id: 'i1',
      descricao: 'Trocar o disjuntor do quadro de luz do apartamento. O quadro é antigo.',
      bairro: 'Centro', tipo: 'proposta', status: 'aberto', expira_em: emMin(320), criado_em: haMin(38),
      categorias: { nome: 'Eletricista' }, perfis: { nome: 'Roberto' } } },
  { id: 'd3', pedido_id: 'q3', profissional_id: 'pro-1', onda: 2, enviado_em: haMin(190),
    visto_em: null, respondido_em: null, resposta: null,
    pedido: { id: 'q3', cliente_id: 'u3', categoria_id: 'c0', cidade_id: 'i1',
      descricao: 'Instalar dois ventiladores de teto e um lustre na sala.',
      bairro: 'São Sebastião', tipo: 'proposta', status: 'aberto', expira_em: emMin(2600), criado_em: haMin(190),
      categorias: { nome: 'Eletricista' }, perfis: { nome: 'Marcia' } } },
  // Os dois que já aceitaram o pedido 'm1' — é assim que a tela de pedidos
  // monta a lista de interessados.
  { id: 'x1', pedido_id: 'm1', profissional_id: 'p1', resposta: 'aceito', respondido_em: haMin(90),
    profissionais: { id: 'p1', documento_verificado_em: '2026-01-01',
      perfis: { nome: 'Carlos Andrade', telefone: '+5531988887777', telefone_confirmado: '+5531988887777' },
      categorias: { nome: 'Eletricista' } } },
  { id: 'x2', pedido_id: 'm1', profissional_id: 'p2', resposta: 'aceito', respondido_em: haMin(40),
    profissionais: { id: 'p2', documento_verificado_em: null,
      perfis: { nome: 'Marcia Ferreira', telefone: '+5531977776666', telefone_confirmado: '+5531977776666' },
      categorias: { nome: 'Eletricista' } } },
];

const MEUS_PEDIDOS = [
  { id: 'm1', cliente_id: 'u1', categoria_id: 'c0', cidade_id: 'i1',
    descricao: 'Preciso trocar o chuveiro do banheiro da suíte. O atual está queimando o disjuntor.',
    bairro: 'Centro', tipo: 'proposta', status: 'aberto', expira_em: emMin(1200), criado_em: haMin(120),
    categorias: { nome: 'Eletricista' },
    disparos: [{ id: 'x1', resposta: 'aceito' }, { id: 'x2', resposta: 'aceito' }, { id: 'x3', resposta: null }] },
  { id: 'm2', cliente_id: 'u1', categoria_id: 'c6', cidade_id: 'i1',
    descricao: 'Faxina completa num apartamento de dois quartos, uma vez por semana.',
    bairro: 'Praia', tipo: 'proposta', status: 'aberto', expira_em: emMin(2000), criado_em: haMin(400),
    categorias: { nome: 'Diarista' }, disparos: [{ id: 'y1', resposta: null }] },
];

const PLANOS = [
  { id: 'pl0', slug: 'basico', nome: 'Básico', descricao: null,
    preco_mensal_centavos: 0, preco_mensal_pj_centavos: 0, onda: null, atraso_minutos: 0,
    whatsapp_liberado: false, ligacao_liberada: false, pedir_proposta: false,
    pedir_orcamento: false, chat_interno: false, estatisticas: false, divulgacao: false,
    destaque_busca: 0, limite_oportunidades_abertas: null, ordem: 10 },
  { id: 'pl1', slug: 'pro', nome: 'Pro', descricao: null,
    preco_mensal_centavos: 4900, preco_mensal_pj_centavos: 7900, onda: 2, atraso_minutos: 60,
    whatsapp_liberado: true, ligacao_liberada: true, pedir_proposta: true,
    pedir_orcamento: true, chat_interno: false, estatisticas: true, divulgacao: false,
    destaque_busca: 10, limite_oportunidades_abertas: 5, ordem: 20 },
  { id: 'pl2', slug: 'premium', nome: 'Premium', descricao: null,
    preco_mensal_centavos: 14900, preco_mensal_pj_centavos: 19900, onda: 1, atraso_minutos: 0,
    whatsapp_liberado: true, ligacao_liberada: true, pedir_proposta: true,
    pedir_orcamento: true, chat_interno: true, estatisticas: true, divulgacao: true,
    destaque_busca: 30, limite_oportunidades_abertas: 15, ordem: 30 },
];

const REPUTACAO = { profissional_id: 'p1', quantas: 12, media: 4.8, boas: 11, ruins: 0, media_recente: 4.9 };

const AVALIACOES = [
  { id: 'a1', profissional_id: 'p1', autor_id: 'u9', nota: 5,
    comentario: 'Chegou na hora combinada e resolveu tudo. Explicou o que estava errado.',
    resposta: null, criada_em: haMin(4000), editada_em: null, perfis: { nome: 'Joana M.' } },
  { id: 'a2', profissional_id: 'p1', autor_id: 'u8', nota: 4,
    comentario: 'Bom serviço, só demorou um pouco para responder.',
    resposta: 'Obrigado! Naquele dia eu estava em outra obra, vou melhorar o retorno.',
    criada_em: haMin(9000), editada_em: null, perfis: { nome: 'Rogério S.' } },
];

const PERFIL = {
  id: 'u1', nome: 'Lorena Braganca', telefone: '+5531999998888',
  telefone_confirmado: '+5531999998888', foto_url: null, cidade_id: 'i1',
  aceitou_termos_em: new Date().toISOString(),
};

/**
 * Ser ou não ser profissional muda metade das telas, então dá para
 * escolher: `EXPO_PUBLIC_DEMO=profissional` entra já cadastrado.
 */
const CADASTRO =
  process.env.EXPO_PUBLIC_DEMO === 'profissional'
    ? { id: 'pro-1', categoria_id: 'c0', cidade_id: 'i1', tipo: 'pf',
        apresentacao: 'Instalação e manutenção elétrica.', raio_km: 15,
        situacao: 'disponivel', ausente_ate: null,
        documento_verificado_em: '2026-01-01', suspenso_em: null }
    : null;

/** Uma consulta que aceita qualquer encadeamento e sempre responde o mesmo. */
function consulta(dados: unknown) {
  const p: any = {
    select: () => p, eq: () => p, is: () => p, not: () => p,
    order: () => p, limit: () => p, update: () => p, insert: () => p, delete: () => p,
    maybeSingle: () => Promise.resolve({ data: dados, error: null }),
    single: () => Promise.resolve({ data: dados, error: null }),
    then: (r: any) =>
      Promise.resolve({
        data: dados,
        error: null,
        count: Array.isArray(dados) ? dados.length : 0,
      }).then(r),
  };
  return p;
}

/* A sessão começa VAZIA, para dar para percorrer o login de verdade. */
const SESSAO = { user: { id: 'u1' }, access_token: 'demonstracao' };
let sessao: any = null;
const ouvintes: ((evento: string, s: any) => void)[] = [];
const avisar = (evento: string) => ouvintes.forEach((f) => f(evento, sessao));

export const supabaseFalso: any = {
  from: (tabela: string) => {
    if (tabela === 'categorias') return consulta(CATEGORIAS);
    if (tabela === 'cidades') return consulta(CIDADES);
    if (tabela === 'perfis') return consulta(PERFIL);
    if (tabela === 'profissionais') return consulta(CADASTRO);
    if (tabela === 'disparos') return consulta(DISPAROS);
    if (tabela === 'pedidos') return consulta(MEUS_PEDIDOS);
    if (tabela === 'planos') return consulta(PLANOS);
    if (tabela === 'reputacao') return consulta(REPUTACAO);
    if (tabela === 'avaliacoes') return consulta(AVALIACOES);
    if (tabela === 'profissionais_publicos') return consulta(PROFISSIONAIS);
    return consulta([]);
  },
  rpc: (nome: string) => {
    if (nome === 'buscar_profissionais') return consulta(PROFISSIONAIS);
    if (nome === 'plano_vigente') return consulta(PLANOS[2]);
    return consulta(null);
  },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: sessao }, error: null }),
    onAuthStateChange: (f: (e: string, s: any) => void) => {
      ouvintes.push(f);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const i = ouvintes.indexOf(f);
              if (i >= 0) ouvintes.splice(i, 1);
            },
          },
        },
      };
    },
    signInWithOtp: () => Promise.resolve({ error: null }),
    // Qualquer código de seis dígitos entra — não existe SMS aqui.
    verifyOtp: () => {
      sessao = SESSAO;
      setTimeout(() => avisar('SIGNED_IN'), 0);
      return Promise.resolve({ error: null });
    },
    signOut: () => {
      sessao = null;
      setTimeout(() => avisar('SIGNED_OUT'), 0);
      return Promise.resolve({ error: null });
    },
  },
};
