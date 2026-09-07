import { supabase } from "./supabase";
import { mensagemDeErro } from "./erros";

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

export async function lerVitrine(): Promise<Vitrine> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* As duas consultas em paralelo: são independentes, e uma atrás da
     outra dobraria a espera de quem abre o site pela primeira vez — que é
     justamente a pessoa com menos paciência para esperar.

     `allSettled` e não `all`: ver `erroVagas`/`erroPessoas` no tipo acima.
     Uma faixa que falha não pode levar a outra junto. */
  const [vagas, pessoas] = await Promise.allSettled([lerVagas(sb), lerPessoas(sb)]);

  const texto = (r: PromiseRejectedResult) =>
    r.reason instanceof Error ? r.reason.message : String(r.reason);

  return {
    vagas: vagas.status === "fulfilled" ? vagas.value.linhas : [],
    totalVagas: vagas.status === "fulfilled" ? vagas.value.total : 0,
    erroVagas: vagas.status === "rejected" ? texto(vagas) : null,
    pessoas: pessoas.status === "fulfilled" ? pessoas.value.linhas : [],
    totalPessoas: pessoas.status === "fulfilled" ? pessoas.value.total : 0,
    erroPessoas: pessoas.status === "rejected" ? texto(pessoas) : null,
  };
}

async function lerVagas(sb: NonNullable<ReturnType<typeof supabase>>) {
  /* `count: "exact"` junto da mesma consulta: o total é o que dá a
     dimensão ("47 vagas abertas"), e pedi-lo numa segunda consulta seria
     uma ida a mais à rede para um número que já vem de graça aqui. */
  const { data, error, count } = await sb
    .from("job_listings")
    .select(
      "id, title, city, uf, salario_a_combinar, salary_range_min, salary_range_max, salario_periodo, created_at, companies(company_name)",
      { count: "exact" }
    )
    /* A policy "Qualquer um lê vaga ativa" (0067) já filtra no banco, mas
       o filtro vai escrito aqui também: policy é a garantia, e este `eq` é
       a intenção. Sem ele, o dia em que a policy mudar esta tela passa a
       mostrar vaga encerrada sem ninguém entender por quê. */
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(QUANTAS);

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
    created_at: v.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}

async function lerPessoas(sb: NonNullable<ReturnType<typeof supabase>>) {
  const { data, error, count } = await sb
    .from("professionals_vitrine")
    .select("id, name, especialidade, city, photo_url, areas_de_interesse", {
      count: "exact",
    })
    /* O mesmo filtro do banco de talentos: quem não preencheu
       `areas_de_interesse` não fez o cadastro do Ei (é gente do procurô, no
       mesmo banco) e não tem o que mostrar aqui. */
    .not("areas_de_interesse", "is", null)
    .neq("areas_de_interesse", "{}")
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
