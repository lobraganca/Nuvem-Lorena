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
  /* O bairro de quem está olhando, para o desempate da ordem (ver o fim
     desta função). Vazio quando não há cadastro ou o campo está em
     branco — e aí o desempate simplesmente não acontece. */
  let meuBairro = "";
  const sb = supabase();
  /* Sem cliente do Supabase, o erro SOBE — nunca vira lista vazia.
     ─────────────────────────────────────────────────────────────────
     "Nenhum profissional em Itabirito" e "a build subiu sem saber com
     qual banco falar" são a MESMA tela e coisas opostas. Aconteceu em
     31/08: o site passou o dia dizendo que a cidade estava vazia porque
     as variáveis de ambiente não foram assadas na build. Ninguém
     percebeu, porque uma lista vazia não parece defeito.

     Aqui não há nenhum caso legítimo de lista vazia: `!sb` quer dizer
     que o app não tem como falar com banco nenhum. */
  if (!sb) throw new Error("Sem conexão com o banco.");

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
        /* `neighborhood` entra em 06/09 para o desempate por bairro, lá
           embaixo. Ele NÃO entra na conta de compatibilidade — ver o
           comentário da ordenação. */
        "id, areas_de_interesse, city, neighborhood, modo_trabalho, cnh, cnh_categorias, " +
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
      meuBairro = String(linha.neighborhood ?? "").trim();

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
    /* ── E O BAIRRO DESEMPATA — 06/09 ────────────────────────────────
       A dona: "o app deve utilizar a localização para sugerir vagas
       melhores aos candidatos. A tela de vagas está vindo marcado a
       cidade. Utilize dessa localização."

       A CIDADE já valia 25 pontos na conta desde sempre. O que não era
       usado é o BAIRRO — e em Itabirito ele decide: o ônibus para o
       distrito passa duas vezes por dia, e uma vaga no Centro e outra na
       Praia não são a mesma oferta para quem mora no Centro.

       Ele entra como DESEMPATE, e não como pontos, de propósito. A conta
       de compatibilidade é a mesma nas três telas do app e é ela que
       decide quem recebe a onda: mexer nos pesos aqui mudaria quem é
       avisado de cada vaga na cidade inteira, que não é o que ela pediu.
       Como desempate, ele só reordena o que já estava empatado — duas
       vagas de 85% deixam de aparecer em ordem arbitrária e a do bairro
       dela vem primeiro.

       `localeCompare` no fim: sem um terceiro critério, duas vagas
       empatadas nos dois primeiros ficariam na ordem que o banco
       devolveu, que muda entre consultas. Lista que troca de ordem
       sozinha parece defeito. */
    const daMinhaRua = (v: VagaNoBanco) =>
      meuBairro && String(v.vaga.neighborhood ?? "").trim().toLocaleLowerCase("pt-BR") ===
        meuBairro.toLocaleLowerCase("pt-BR")
        ? 1
        : 0;
    lista.sort(
      (a, b) =>
        (b.compatibilidade ?? 0) - (a.compatibilidade ?? 0) ||
        daMinhaRua(b) - daMinhaRua(a) ||
        (a.vaga.title ?? "").localeCompare(b.vaga.title ?? "", "pt-BR")
    );
  }

  /* ── A ORDEM DA LISTA É A DA COMPATIBILIDADE, E SÓ — 06/09 ────────
     A dona: "o em alta aparece já primeiro e depois na lista de todos
     aparece de novo, em primeiro. Na lista onde tem todos, não há
     necessidade de aparecer primeiro novamente. Faça isso também para as
     empresas."

     Aqui havia um `sort` pondo as vagas pagas na frente. Ele nasceu em
     04/09 ("também opção de dar destaque a uma vaga"), quando a lista era
     uma só e o topo dela ERA o destaque.

     Com a faixa própria de destaque (05/09), o `sort` virou repetição: a
     mesma vaga no alto da faixa e de novo no alto da lista logo abaixo,
     duas vezes seguidas, com o mesmo selo. O que se compra é a faixa.

     A vaga paga continua na lista de baixo — ela não sai de lugar
     nenhum —, agora na posição que a COMPATIBILIDADE lhe der, que é a
     ordem que serve a quem está procurando. */

  return lista;
}

/** As cidades que têm vaga no ar — para o filtro não oferecer cidade vazia. */
export async function cidadesComVaga(): Promise<string[]> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { data, error } = await sb
    .from("job_listings")
    .select("city")
    .eq("status", "active");
  if (error) throw error;
  const cidades = new Set<string>();
  (data ?? []).forEach((v: any) => v.city && cidades.add(v.city));
  return [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
