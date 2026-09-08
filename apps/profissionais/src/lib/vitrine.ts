import { supabase } from "./supabase";
import { mensagemDeErro } from "./erros";
import { numerosDoEi } from "./numerosDoEi";
import { lerTudo } from "./lerTudo";

/**
 * O que a cidade tem, para quem ainda não tem conta.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao entrar no site a pessoa tem que ter uma tela bonita pra ver
 * as vagas e os candidatos. Sem ter que fazer login. Se quiser abrir uma
 * vaga ou se candidatar tem que fazer login."
 *
 * ── ISTO DESFAZ UM PEDIDO ANTERIOR, E É DE PROPÓSITO ──────────────────
 *
 * Em 01/09 ela pediu o contrário, com todas as letras: "todos devem criar
 * conta ao entrar, até mesmo pra ver". Foi por causa daquele pedido que o
 * link "ver sem conta" saiu da tela de entrada.
 *
 * Está escrito aqui para a próxima sessão não "consertar" isto de volta
 * achando que é regressão. A regra de hoje é a de 07/09.
 *
 * ── O QUE SAI SEM CONTA, E O QUE NÃO SAI ──────────────────────────────
 *
 * Sai: a vaga aberta (título, empresa, cidade, salário) e o candidato
 * (nome, ofício, foto, cidade). É o que faz a cidade parecer viva para
 * quem chega, e é o que uma vaga é — um anúncio.
 *
 * NÃO sai contato de ninguém. Nem telefone, nem WhatsApp, nem e-mail, nem
 * a `bio` (que é texto livre, e gente escreve telefone ali). Isso não é
 * excesso de zelo: a migration 0118 fechou essa porta porque por ela saía,
 * com uma linha de `curl`, a lista de telefones de todos os desempregados
 * da cidade — que é exatamente o insumo do golpe de emprego falso. A
 * vitrine é uma view separada, sem essas colunas (0132), e a view com
 * telefone continua fechada para quem não entrou.
 *
 * É também o que mantém o produto pago de pé: a empresa paga para falar
 * com as pessoas, não para saber que elas existem.
 */

/** Uma vaga, do jeito que a vitrine mostra. */
export type VagaDaVitrine = {
  id: string;
  title: string;
  city: string | null;
  uf: string | null;
  empresa: string | null;
  /* Os nomes são os do banco (0067/0106) e não os que eu chutaria: a
     coluna chama `salary_range_min`, e o "a combinar" chama
     `salario_a_combinar`. Renomear aqui obrigaria a traduzir de volta na
     hora de chamar `salarioEmTexto`, que é quem sabe formatar isto. */
  salario_a_combinar: boolean;
  salary_range_min: number | null;
  salary_range_max: number | null;
  salario_periodo: string | null;
  /** Até quando a vaga fica no topo (0116). Passado ou nulo = sem destaque. */
  destaque_ate: string | null;
  created_at: string;
};

/** Uma pessoa, do jeito que a vitrine mostra. Sem contato nenhum. */
export type PessoaDaVitrine = {
  id: string;
  name: string | null;
  especialidade: string | null;
  city: string | null;
  photo_url: string | null;
  areas_de_interesse: string[] | null;
};

export type Vitrine = {
  /** As vagas em destaque (pagas), separadas — a dona pediu prateleira só delas. */
  destaques: VagaDaVitrine[];
  vagas: VagaDaVitrine[];
  pessoas: PessoaDaVitrine[];
  /** Quantas vagas e quantas pessoas existem ao todo, não só as mostradas. */
  totalVagas: number;
  totalPessoas: number;
  /* ── UMA METADE QUEBRADA NÃO APAGA A OUTRA ────────────────────────
     Cada faixa carrega o próprio erro. A primeira versão usava um
     `Promise.all`, e o efeito era ruim justamente na janela em que ele
     mais aconteceria: enquanto a migration 0132 não estivesse aplicada,
     a consulta de candidatos falharia e levaria as VAGAS junto — a
     página inteira viraria uma mensagem de erro, quando metade dela
     funcionava perfeitamente.

     `null` é "esta faixa está bem". */
  erroVagas: string | null;
  erroPessoas: string | null;
  /* Quantas pessoas o app já empregou (0125). `null` quando o banco ainda
     não tem a função, ou quando ninguém foi contratado ainda — e nos dois
     casos a tela simplesmente não mostra o número, em vez de mostrar um
     zero. "0 já contrataram" é pior que silêncio: é a única frase da capa
     que faria alguém fechar o app. */
  contratados: number | null;
  /** As cidades que têm alguma coisa, com quantas — para o seletor. */
  cidades: [string, number][];
};

/**
 * A view nova ainda não existe no banco?
 *
 * Enquanto a 0132 não for colada no SQL Editor, `professionals_vitrine`
 * não existe — e o PostgREST responde com um destes. Sem reconhecer o
 * caso, a tela mostraria "ninguém disponível", que é a mentira calma que o
 * CLAUDE.md manda evitar: a tela fica normal e o defeito não aparece.
 */
function faltaAVitrine(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string };
  const texto = (e?.message ?? "").toLowerCase();
  return (
    e?.code === "42P01" ||
    e?.code === "PGRST205" ||
    texto.includes("does not exist") ||
    texto.includes("could not find the table")
  );
}

/** Quantas linhas cada faixa mostra. Poucas: isto é vitrine, não lista. */
const QUANTAS = 6;

/* As vagas vêm em UMA consulta e são separadas aqui, e não em duas
   consultas com filtros opostos. Duas consultas é uma ida a mais à rede na
   abertura do site — e, pior, elas podem discordar: uma vaga cujo destaque
   vence entre a primeira e a segunda apareceria nas duas prateleiras, ou
   em nenhuma. Pedimos o dobro para as duas prateleiras terem o que
   mostrar. */
function estaEmDestaque(v: VagaDaVitrine): boolean {
  return !!v.destaque_ate && new Date(v.destaque_ate).getTime() > Date.now();
}

/**
 * A vitrine de UMA cidade.
 *
 * `cidade` vazia é "todas as cidades" — uma escolha legítima, e não a
 * ausência de escolha: numa região onde muita gente pega ônibus para a
 * cidade vizinha, travar tudo na própria cidade esconde justamente a vaga
 * que fica a vinte minutos. É a mesma convenção do resto do app
 * (`TODAS_AS_CIDADES`, em `cidadeEscolhida.ts`).
 */
export async function lerVitrine(cidade: string): Promise<Vitrine> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* As duas consultas em paralelo: são independentes, e uma atrás da
     outra dobraria a espera de quem abre o site pela primeira vez — que é
     justamente a pessoa com menos paciência para esperar.

     `allSettled` e não `all`: ver `erroVagas`/`erroPessoas` no tipo acima.
     Uma faixa que falha não pode levar a outra junto. */
  const [vagas, pessoas, numeros, cidades] = await Promise.allSettled([
    lerVagas(sb, cidade),
    lerPessoas(sb, cidade),
    /* Este já sabe devolver `null` quando a função não existe no banco —
       ver `numerosDoEi.ts`. Entra no mesmo `allSettled` para não ser mais
       uma ida à rede em série na abertura do site. */
    numerosDoEi(),
    /* A lista de cidades NÃO é filtrada por cidade — se fosse, escolher
       Ouro Preto deixaria o seletor com Ouro Preto só, e não haveria como
       voltar. É o tipo de beco que só aparece depois de publicado. */
    lerCidades(sb),
  ]);

  const texto = (r: PromiseRejectedResult) =>
    r.reason instanceof Error ? r.reason.message : String(r.reason);

  const todasAsVagas = vagas.status === "fulfilled" ? vagas.value.linhas : [];

  return {
    destaques: todasAsVagas.filter(estaEmDestaque).slice(0, QUANTAS),
    vagas: todasAsVagas.filter((v) => !estaEmDestaque(v)).slice(0, QUANTAS),
    totalVagas: vagas.status === "fulfilled" ? vagas.value.total : 0,
    erroVagas: vagas.status === "rejected" ? texto(vagas) : null,
    pessoas: pessoas.status === "fulfilled" ? pessoas.value.linhas : [],
    totalPessoas: pessoas.status === "fulfilled" ? pessoas.value.total : 0,
    erroPessoas: pessoas.status === "rejected" ? texto(pessoas) : null,
    contratados:
      numeros.status === "fulfilled" && (numeros.value?.contratados ?? 0) > 0
        ? numeros.value!.contratados
        : null,
    /* Falhar aqui esconde o seletor e não quebra mais nada: a tela mostra
       a cidade que já estava escolhida. Um seletor a menos é chato; uma
       vitrine que não abre por causa dele seria bem pior. */
    cidades: cidades.status === "fulfilled" ? cidades.value : [],
  };
}

async function lerVagas(sb: NonNullable<ReturnType<typeof supabase>>, cidade: string) {
  /* `count: "exact"` junto da mesma consulta: o total é o que dá a
     dimensão ("47 vagas abertas"), e pedi-lo numa segunda consulta seria
     uma ida a mais à rede para um número que já vem de graça aqui. */
  let q = sb
    .from("job_listings")
    .select(
      "id, title, city, uf, salario_a_combinar, salary_range_min, salary_range_max, salario_periodo, destaque_ate, created_at, companies(company_name)",
      { count: "exact" }
    )
    /* A policy "Qualquer um lê vaga ativa" (0067) já filtra no banco, mas
       o filtro vai escrito aqui também: policy é a garantia, e este `eq` é
       a intenção. Sem ele, o dia em que a policy mudar esta tela passa a
       mostrar vaga encerrada sem ninguém entender por quê. */
    .eq("status", "active");
  /* O filtro entra DEPOIS do `select` e só quando há cidade: `.eq("city",
     "")` não devolveria "todas", devolveria as linhas com cidade vazia —
     ou seja, nenhuma. */
  if (cidade) q = q.eq("city", cidade);

  const { data, error, count } = await q
    /* Destaque primeiro, e depois a mais nova. É a mesma ordem do banco de
       vagas — quem pagou pelo topo tem de aparecer no topo aqui também,
       senão a vitrine desmente o que a empresa comprou. */
    .order("destaque_ate", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(QUANTAS * 2);

  if (error) throw new Error(mensagemDeErro(error, "Não consegui carregar as vagas."));

  const linhas: VagaDaVitrine[] = (data ?? []).map((v: Record<string, any>) => ({
    id: v.id,
    title: v.title,
    city: v.city,
    uf: v.uf,
    /* O `companies(...)` do PostgREST vem como objeto ou como lista de um,
       dependendo de como ele lê a relação. Tratar os dois é mais barato
       que descobrir qual é na próxima vez que a consulta mudar. */
    empresa: Array.isArray(v.companies)
      ? (v.companies[0]?.company_name ?? null)
      : (v.companies?.company_name ?? null),
    salario_a_combinar: !!v.salario_a_combinar,
    salary_range_min: v.salary_range_min ?? null,
    salary_range_max: v.salary_range_max ?? null,
    salario_periodo: v.salario_periodo ?? null,
    destaque_ate: v.destaque_ate ?? null,
    created_at: v.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}

async function lerPessoas(sb: NonNullable<ReturnType<typeof supabase>>, cidade: string) {
  let q = sb
    .from("professionals_vitrine")
    .select("id, name, especialidade, city, photo_url, areas_de_interesse", {
      count: "exact",
    });
  if (cidade) q = q.eq("city", cidade);

  /* ── TODO MUNDO APARECE, MESMO SEM ÁREA MARCADA — 07/09 ─────────────
     A dona: "algumas pessoas não estão aparecendo na tela inicial porque
     não colocaram serviço. Coloque todas as pessoas na tela.
     Independente de como está o cadastro."

     Aqui havia `.not(areas_de_interesse is null)` e `.neq("{}")`, o mesmo
     filtro do banco de talentos. Ele nasceu para separar quem fez o
     cadastro do EI de quem veio do procurô (mesmo banco, outra coluna) —
     e essa separação fazia sentido quando a lista era o produto.

     Numa cidade que está começando, ela custa mais do que resolve: cada
     pessoa escondida é uma pessoa a menos na tela que a empresa abre para
     decidir se o app serve. E a pessoa não fez nada de errado — ela
     preencheu o cadastro que existia.

     O que continua valendo (e é a `professionals_vitrine`, 0132):
     suspenso não aparece, oculto não aparece, telefone não confirmado não
     aparece. Esses três são decisão de alguém; "não marcou área" é só um
     campo em branco.

     O QUE NÃO MUDA: o aviso de vaga continua cruzando por
     `areas_de_interesse`. Quem não marcou nenhuma aparece na busca e não
     recebe aviso nenhum — e é isso que o painel administrativo passa a
     dizer, com essas palavras. */
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .limit(QUANTAS);

  if (error) {
    if (faltaAVitrine(error)) {
      /* Erro nomeado, e não lista vazia. Quem abrir o site antes de a SQL
         ser colada vê "não consegui carregar", que é a verdade — e não
         "ninguém disponível em Itabirito", que faria a dona achar que a
         cidade está vazia. */
      throw new Error(
        "A lista de candidatos ainda não está publicada no banco. " +
          "Falta aplicar a migration 0132."
      );
    }
    throw new Error(mensagemDeErro(error, "Não consegui carregar os candidatos."));
  }

  return {
    linhas: (data ?? []) as PessoaDaVitrine[],
    total: count ?? (data ?? []).length,
  };
}


/**
 * Lê a lista de candidatos da view nova, com volta para a antiga.
 *
 * A `professionals_vitrine` (0132) é a que abre sem conta. A
 * `professionals_public` é a antiga, com telefone, fechada para quem não
 * entrou (0118) — e é a volta enquanto a SQL não for colada no painel.
 *
 * Existe porque a ordem certa (SQL primeiro, código depois) depende de
 * alguém lembrar todas as vezes, e o preço de esquecer uma vez é o app
 * parado. É a mesma ideia do `colunasNovas.ts`, para uma view inteira:
 * tenta a nova, e se o banco disser que ela não existe, refaz com a
 * antiga. Quem já tem conta nem percebe; quem não tem vê o erro nomeado,
 * que é a verdade, em vez de uma lista vazia.
 */
export async function lerComVitrine<T>(
  carregar: (view: string) => Promise<T[]>
): Promise<T[]> {
  try {
    return await carregar("professionals_vitrine");
  } catch (erro) {
    if (!faltaAVitrine(erro)) throw erro;
    console.warn(
      "[Ei] a professionals_vitrine ainda não existe no banco — falta aplicar " +
        "a migration 0132. Lendo a view antiga, que exige conta."
    );
    return carregar("professionals_public");
  }
}


/**
 * As cidades que têm alguma coisa, com quantas coisas em cada uma.
 *
 * ── POR QUE ISTO EXISTE ───────────────────────────────────────────────
 *
 * A dona: "na primeira tela ter um botão para escolha da cidade. O app
 * funcionará em mais cidades."
 *
 * A lista sai DOS DADOS, e não de uma lista fixa de cidades escrita no
 * código. Uma fileira com "Congonhas" numa hora em que Congonhas não tem
 * nada é um filtro que só sabe devolver tela vazia — e é o mesmo motivo
 * pelo qual os ofícios do banco de talentos são contados em vez de
 * listados à mão.
 *
 * ── SOMA VAGA E PESSOA ────────────────────────────────────────────────
 *
 * O número ao lado de cada cidade é "quanta coisa tem aqui", e não
 * "quantas vagas": quem abre a tela pode estar procurando emprego OU
 * procurando gente, e a mesma lista serve aos dois. Separar em duas
 * contagens obrigaria a perguntar de que lado a pessoa está antes de ela
 * escolher a cidade — que é justamente a ordem que esta tela evita.
 *
 * ── `lerTudo` E NÃO UM `select` SIMPLES ───────────────────────────────
 *
 * A 0062 pôs teto de 200 linhas por consulta. Com um `select` direto, a
 * cidade nº 201 sumiria da lista sem nada avisando — e o seletor mentiria
 * dizendo que a cidade não existe.
 */
async function lerCidades(
  sb: NonNullable<ReturnType<typeof supabase>>
): Promise<[string, number][]> {
  const [vagas, pessoas] = await Promise.all([
    lerTudo<{ city: string | null }>(() =>
      sb.from("job_listings").select("city").eq("status", "active")
    ),
    /* Sem o filtro de área, como a lista acima: a contagem de cidades
       tem de bater com o que a tela mostra, senão o seletor oferece
       "Ouro Preto 3" e a prateleira abre com cinco. */
    lerTudo<{ city: string | null }>(() =>
      sb.from("professionals_vitrine").select("city")
    ),
  ]);

  const conta = new Map<string, number>();
  for (const linha of [...vagas, ...pessoas]) {
    const c = (linha.city ?? "").trim();
    if (!c) continue;
    conta.set(c, (conta.get(c) ?? 0) + 1);
  }
  /* Ordenadas por quantidade, e a de mesmo tamanho pelo nome: assim a
     lista não troca de ordem sozinha entre uma abertura e outra. */
  return [...conta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
