/**
 * O banco de vagas: tudo que está no ar, para quem quiser procurar.
 *
 * ── POR QUE ELE EXISTE ─────────────────────────────────────────────────
 *
 * A dona: "tem que criar um banco de vagas, assim como o de talentos, nela
 * as pessoas poderão acessar as vagas que estão em aberto das empresas."
 *
 * Até agora a vaga só chegava por ONDA: a empresa publica, o app escolhe
 * quem combina, e o aviso cai para essas pessoas. É um bom caminho e
 * continua existindo — mas ele decide por quem procura trabalho.
 *
 * Quem não foi escolhido pela onda não fica sabendo que a vaga existe, e
 * a onda erra: ela compara texto. Alguém cadastrado como "auxiliar de
 * limpeza" não recebe a vaga de "camareira" mesmo sendo exatamente a
 * pessoa. E há quem topasse mudar de ramo, o que nenhuma comparação
 * automática vai adivinhar.
 *
 * O banco de vagas é a lista aberta: está tudo aqui, procure você mesma.
 *
 * ── A COMPATIBILIDADE APARECE, MAS NÃO BARRA ───────────────────────────
 *
 * Cada vaga mostra o quanto ela combina com o cadastro de quem está
 * olhando. Isso serve para ORDENAR a atenção, não para fechar porta: quem
 * quiser responder a uma vaga de 20% responde.
 *
 * A conta é sobre TEXTO que as pessoas escreveram, e portanto é um
 * palpite. Barrar por palpite descarta justamente quem não se descreveu
 * direito — e essa pessoa costuma ser quem mais precisa.
 *
 * (Quando a 0105 estiver aplicada, a empresa poderá marcar QUAIS campos
 * pesam nesta vaga, e dizer se aceita candidatura de quem não bate. Até
 * lá a conta usa o que já existe: função, cidade e modo de trabalho.)
 */
import { supabase } from "./supabase";
import type { JobListing } from "../types/domain";
/* A conta mora em `compatibilidade.ts` desde 03/09: ela passou a decidir
   também quem a onda avisa, e duas cópias da mesma fórmula divergiriam
   sem ninguém perceber — a tela diria 82% e a onda trataria como 60%. */
import { calcular, ESCADA_ESCOLARIDADE, type QuemOlha } from "./compatibilidade";
import { vagaEmDestaque } from "./destaque";
import { lerTolerando } from "./colunasNovas";

export type VagaNoBanco = {
  vaga: JobListing;
  empresa: string;
  empresa_foto: string | null;
  /** 0 a 100. `null` para quem não tem cadastro de profissional. */
  compatibilidade: number | null;
  /** O que casou, em português, para a tela poder explicar o número. */
  porque: string[];
  /** O que a vaga pedia e o cadastro não respondeu — por CAMPO. Ver
      `calcular` e a seção "o que está custando vagas" do desempenho. */
  faltou: string[];
  /** Já respondeu a esta? `undefined` = ainda não. */
  interessado?: boolean;
};

/**
 * Todas as vagas no ar, da mais nova para a mais velha.
 *
 * Erro SOBE, nunca vira lista vazia. "Nenhuma vaga em Itabirito hoje" e
 * "não consegui ler as vagas" são a mesma tela e coisas opostas — e esta é
 * das telas em que a mentira calada custa o emprego de alguém.
 */
export async function bancoDeVagas(userId?: string): Promise<VagaNoBanco[]> {
  const sb = supabase();
  if (!sb) return [];

  /* A lista de colunas é escrita à mão, uma a uma, como em `minhasVagas`.
     Coluna nova que ninguém acrescente aqui chega indefinida, sem erro
     nenhum para avisar — e o cartão passa a dizer "não informado" em toda
     vaga.

     `companies_public` e não `companies`: a tabela só tem policy de leitura
     do próprio dono (0066), então quem procura trabalho não enxerga empresa
     nenhuma — e o `!inner` derrubaria a vaga junto, devolvendo ZERO linhas
     sem erro. É o defeito que a 0100 existe para consertar. O apelido
     `companies:` mantém o nome da chave na resposta. */
  /* As três últimas colunas da lista (`aceita_primeiro_emprego`,
     `vaga_para_pcd` e `destaque_ate`) são das migrations 0114, 0115 e
     0116, aplicadas à mão pela dona — o código sobe antes. Pedir coluna
     que ainda não existe faz o PostgREST recusar a consulta INTEIRA, e a
     tela mostraria "não consegui carregar as vagas" para a cidade toda.
     `lerTolerando` refaz sem elas nesse caso (ver `colunasNovas.ts`). */
  const { data, error } = await lerTolerando<any[]>(
    `id, company_id, title, description, profession, specialty,
     required_experience, skills, salary_range_min, salary_range_max,
     available_immediately, work_modality, city, uf, neighborhood,
     anunciada_ate, status, created_at, closed_at,
     tipo_contrato, jornada, beneficios, salario_a_combinar, salario_periodo,
     quantidade_vagas, data_inicio, prazo_candidatura, horario, escala,
     aceita_outras_cidades, comissao, outros_beneficios,
     escolaridade_minima, curso_especifico, cnh_exigida, cnh_categorias,
     exige_viagem, idiomas, observacoes,
     campos_compatibilidade, aceita_sem_compatibilidade, aceita_primeiro_emprego,
     vaga_para_pcd, destaque_ate,
     companies:companies_public!inner ( company_name, photo_url )`,
    ["aceita_primeiro_emprego", "vaga_para_pcd", "destaque_ate"],
    (colunas) =>
      sb
        .from("job_listings")
        .select(colunas)
        .eq("status", "active")
        .order("created_at", { ascending: false })
  );

  if (error) throw error;

  /* Quem está olhando. A leitura falha? O erro sobe junto: mostrar a lista
     sem compatibilidade nenhuma pareceria "você não combina com nada". */
  let quem: QuemOlha | null = null;
  const respondidas = new Map<string, boolean>();
  if (userId) {
    /* `order` + `limit(1)`, e nunca `maybeSingle()`.
       ─────────────────────────────────────────────
       `maybeSingle()` aceita nenhuma linha e ERRA com mais de uma
       (PGRST116). Só que existe gente com DOIS cadastros: eles foram
       possíveis até 03/09, quando a dona pediu "a pessoa só pode ter um" —
       e os antigos continuam no banco. Para essas pessoas o banco de vagas
       inteiro virava a mensagem "não consegui carregar as vagas", sem
       nada que explicasse o motivo.

       É o mesmo defeito que já apareceu três vezes neste projeto
       (`obterMinhaEmpresa`, `lerMeuPerfil`, `responderVaga`), e foi
       encontrado aqui exercitando o app com uma conta de dois cadastros. */
    const { data: perfis, error: erroPerfil } = await sb
      .from("professionals")
      .select(
        "id, areas_de_interesse, city, modo_trabalho, cnh, cnh_categorias, " +
          "aceita_viajar, inicio_imediato, fim_de_semana, " +
          "pretensao_centavos, pretensao_combinar, disponibilidade"
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (erroPerfil) throw erroPerfil;
    const p = (perfis ?? [])[0] ?? null;
    if (p) {
      const linha = p as Record<string, any>;

      /* A escolaridade não é coluna: é a maior das linhas de FORMAÇÃO na
         `professional_courses` (0104). Numa consulta à parte porque o
         PostgREST não sabe juntar por este caminho sem uma relação
         declarada — e forçá-la deixaria a consulta de cima frágil a
         qualquer mexida no schema.

         Falhar aqui NÃO derruba nada: sem ela o critério de escolaridade
         simplesmente não bate, e é o mesmo que a empresa teria antes de a
         coluna existir. Derrubar a lista de vagas inteira por causa de um
         critério seria trocar a tela útil por uma mensagem de erro. */
      let escolaridade: string | null = null;
      try {
        const { data: f } = await sb
          .from("professional_courses")
          .select("nivel")
          .eq("professional_id", linha.id)
          .eq("tipo", "formacao");
        for (const linhaF of (f ?? []) as { nivel: string | null }[]) {
          if (!linhaF.nivel) continue;
          if (
            escolaridade == null ||
            ESCADA_ESCOLARIDADE.indexOf(linhaF.nivel) > ESCADA_ESCOLARIDADE.indexOf(escolaridade)
          ) {
            escolaridade = linhaF.nivel;
          }
        }
      } catch {
        /* ver acima */
      }

      quem = {
        funcoes: linha.areas_de_interesse ?? [],
        cidade: linha.city ?? "",
        modo: linha.modo_trabalho ?? null,
        temCnh: linha.cnh ?? false,
        cnhCategorias: linha.cnh_categorias ?? [],
        aceitaViajar: linha.aceita_viajar ?? false,
        inicioImediato: linha.inicio_imediato ?? false,
        fimDeSemana: linha.fim_de_semana ?? false,
        pretensaoCentavos: linha.pretensao_centavos ?? null,
        pretensaoCombinar: linha.pretensao_combinar ?? false,
        disponibilidade: linha.disponibilidade ?? [],
        escolaridade,
      };

      const { data: r, error: erroResposta } = await sb
        .from("job_responses")
        .select("job_listing_id, interessado")
        .eq("professional_id", userId);
      if (erroResposta) throw erroResposta;
      (r ?? []).forEach((x: any) => respondidas.set(x.job_listing_id, x.interessado !== false));
    }
  }

  const lista = (data ?? []).map((v: any) => {
    const { nota, porque, faltou } = calcular(v as JobListing, quem);
    return {
      vaga: v as JobListing,
      empresa: v.companies?.company_name ?? "",
      empresa_foto: v.companies?.photo_url ?? null,
      compatibilidade: nota,
      porque,
      faltou,
      interessado: respondidas.get(v.id),
    };
  });

  /* Ordena pela compatibilidade quando ela existe, e pela data quando não.
     Quem não tem cadastro vê a lista em ordem cronológica, que é a única
     ordem honesta para quem o app ainda não conhece. */
  if (quem) {
    lista.sort((a, b) => (b.compatibilidade ?? 0) - (a.compatibilidade ?? 0));
  }

  /* ── A VAGA EM DESTAQUE VEM PRIMEIRO — 04/09 ──────────────────────
     A dona: "também opção de dar destaque a uma vaga" (R$ 19,90 por 7
     dias).

     A ordenação do destaque é feita DEPOIS da de compatibilidade, e não
     no lugar dela: dentro do grupo das destacadas, quem mais combina
     continua na frente. Assim o dinheiro compra o topo da lista, e não a
     ordem interna — e quem paga por uma vaga que não tem nada a ver com
     ninguém não passa na frente de uma vaga destacada que combina.

     `sort` do JavaScript é estável (garantido desde 2019), então a ordem
     de cima sobrevive dentro de cada grupo. */
  lista.sort((a, b) => Number(vagaEmDestaque(b.vaga)) - Number(vagaEmDestaque(a.vaga)));

  return lista;
}

/** As cidades que têm vaga no ar — para o filtro não oferecer cidade vazia. */
export async function cidadesComVaga(): Promise<string[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("job_listings")
    .select("city")
    .eq("status", "active");
  if (error) throw error;
  const cidades = new Set<string>();
  (data ?? []).forEach((v: any) => v.city && cidades.add(v.city));
  return [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
