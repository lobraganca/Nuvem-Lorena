/**
 * Ler o que o banco disse quando ele recusa alguma coisa.
 *
 * Este arquivo existe por causa de um defeito específico, e vale contar a
 * história porque ela se repete sozinha em quem não sabe dela:
 *
 * O erro do Supabase **não é um `Error`**. É um objeto solto, com `message`
 * e `code`, que não passa no `instanceof Error`. Então o padrão que todo
 * mundo escreve por reflexo:
 *
 *     err instanceof Error ? err.message : "Algo deu errado"
 *
 * ...cai SEMPRE no texto genérico. O app diz "algo deu errado" para tudo:
 * para o RLS que barrou, para a coluna que não existe, para a internet que
 * caiu. Ninguém consegue distinguir, ninguém reporta direito, e o defeito
 * de verdade fica invisível. Num projeto vizinho isso escondeu por semanas
 * que nenhuma pessoa conseguia avaliar ninguém.
 *
 * Aqui a leitura é por formato, não por tipo — e o texto que sobra é em
 * português, dizendo o que aconteceu para quem não sabe o que é policy.
 */

/** Os códigos que o PostgREST e o Postgres devolvem e que dá para traduzir. */
const RECADO_POR_CODIGO: Record<string, string> = {
  // RLS barrou. É o mais comum e o mais confundido com bug — quase sempre
  // é permissão mesmo.
  '42501': 'Esta conta não tem permissão para fazer isso.',
  PGRST301: 'Sua sessão expirou. Entre de novo, por favor.',
  // Violação de unicidade.
  '23505': 'Isso já está cadastrado.',
  // Chave estrangeira: aponta para algo que não existe (ou foi apagado).
  '23503': 'Algum dado ligado a este cadastro não existe mais.',
  // Coluna que o app mandou e o banco não conhece. Na prática: falta rodar
  // uma migration. O recado precisa dizer isso, porque é o único jeito de
  // alguém perceber a tempo.
  PGRST204: 'O app mandou um campo que o banco ainda não tem. Falta aplicar uma atualização no banco.',
  '42703': 'O app mandou um campo que o banco ainda não tem. Falta aplicar uma atualização no banco.',
  // Checagem de coluna recusou o valor.
  '23514': 'Algum valor preenchido não é aceito.',
};

type ErroDoSupabase = { message?: unknown; code?: unknown; details?: unknown };

function pareceErroDoSupabase(valor: unknown): valor is ErroDoSupabase {
  return typeof valor === 'object' && valor !== null && ('message' in valor || 'code' in valor);
}

/**
 * Devolve uma frase em português para mostrar na tela.
 *
 * `padrao` é o que aparece quando não dá para saber mais nada — escreva um
 * padrão que diga o que a pessoa estava tentando fazer ("não deu para
 * salvar seu cadastro"), nunca "erro inesperado".
 */
export function mensagemDeErro(err: unknown, padrao: string): string {
  if (!err) return padrao;

  if (pareceErroDoSupabase(err)) {
    const codigo = typeof err.code === 'string' ? err.code : undefined;
    if (codigo && RECADO_POR_CODIGO[codigo]) return RECADO_POR_CODIGO[codigo];

    const texto = typeof err.message === 'string' ? err.message.trim() : '';
    // Mensagem do Postgres vem em inglês e cheia de jargão ("new row
    // violates row-level security policy"). Mostrar isso para quem só quer
    // cadastrar um serviço não ajuda ninguém.
    if (texto && !pareceJargao(texto)) return texto;
  }

  if (err instanceof Error && err.message && !pareceJargao(err.message)) {
    return err.message;
  }

  return padrao;
}

/** Falha de rede tem tratamento próprio: dá para tentar de novo, e vale dizer isso. */
export function eFalhaDeRede(err: unknown): boolean {
  const texto = pareceErroDoSupabase(err) && typeof err.message === 'string'
    ? err.message
    : err instanceof Error ? err.message : '';
  return /network|fetch|timeout|failed to fetch|conexão|offline/i.test(texto);
}

function pareceJargao(texto: string): boolean {
  return /row-level security|violates|constraint|relation .* does not exist|permission denied for|JWT|PGRST/i.test(
    texto,
  );
}

/**
 * O erro que uma função de dados deve lançar quando não consegue responder.
 *
 * Existe para sustentar uma regra que vale para o app inteiro:
 *
 *   **Função de dados que falha NUNCA devolve lista vazia.**
 *
 * "Nenhum resultado" é uma mentira calma. A tela desenha normalmente, diz
 * "nada encontrado", e o defeito não aparece em lugar nenhum: nem para
 * quem usa, nem no relatório, nem para quem procura o problema depois. Um
 * `catch` que devolve `[]` é a forma mais eficiente conhecida de esconder
 * um defeito de produção — a busca some, e o app continua parecendo são.
 *
 * Quem falha, lança. Quem chama, mostra o recado.
 */
export class ErroDeDados extends Error {
  readonly causa: unknown;
  constructor(mensagem: string, causa?: unknown) {
    super(mensagem);
    this.name = 'ErroDeDados';
    this.causa = causa;
  }
}
