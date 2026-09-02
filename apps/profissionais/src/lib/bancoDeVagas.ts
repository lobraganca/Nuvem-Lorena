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

export type VagaNoBanco = {
  vaga: JobListing;
  empresa: string;
  empresa_foto: string | null;
  /** 0 a 100. `null` para quem não tem cadastro de profissional. */
  compatibilidade: number | null;
  /** O que casou, em português, para a tela poder explicar o número. */
  porque: string[];
  /** Já respondeu a esta? `undefined` = ainda não. */
  interessado?: boolean;
};

/** O cadastro de quem está olhando, na forma que a conta precisa. */
type QuemOlha = {
  funcoes: string[];
  cidade: string;
  modo: string | null;
  temCnh: boolean;
  cnhCategorias: string[];
  aceitaViajar: boolean;
  inicioImediato: boolean;
  fimDeSemana: boolean;
  pretensaoCentavos: number | null;
  pretensaoCombinar: boolean;
  disponibilidade: string[];
  /** A maior escolaridade concluída ou em curso. Vem de outra tabela. */
  escolaridade: string | null;
};

/* A escolaridade em ORDEM, para poder comparar "tem pelo menos".
   Sem a ordem, comparar escolaridade seria comparar duas palavras — e
   "superior" não é maior que "medio" em ordem alfabética. */
const ESCADA_ESCOLARIDADE = [
  "fundamental",
  "medio",
  "tecnico",
  "superior",
  "pos",
  "mestrado",
  "doutorado",
];

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    /* Tira o acento. Sem isto "atendimento a domicílio" e "atendimento a
       domicilio" são duas coisas diferentes para o computador, e são a
       mesma para todo mundo que digitou. */
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Quanto esta vaga combina com este cadastro, de 0 a 100.
 *
 * Os pesos não são arbitrários: são a ordem em que as coisas eliminam um
 * candidato de verdade.
 *
 *   função (60)  é o que decide se a conversa começa;
 *   cidade (25)  numa cidade pequena, "é longe" acaba com a vaga — e o
 *                ônibus para o distrito passa duas vezes por dia;
 *   modo   (15)  presencial x remoto, que raramente elimina aqui mas
 *                aparece nas vagas de atendimento e vendas.
 *
 * Sem cadastro nenhum devolve `null`, e não zero: "não sei" e "não combina"
 * são coisas diferentes, e mostrar 0% para quem ainda não se cadastrou
 * diria a ela que não serve para nada.
 */
function calcular(
  vaga: JobListing,
  quem: QuemOlha | null
): { nota: number | null; porque: string[] } {
  if (!quem || quem.funcoes.length === 0) return { nota: null, porque: [] };

  /* ── OS CAMPOS QUE A EMPRESA MARCOU (item 16, coluna da 0105) ───────
     Lista vazia = a empresa não escolheu, e aí vale a comparação padrão:
     função e cidade, que é o que este app sempre fez. É diferente de
     marcar um campo só — e essa diferença é o motivo de a coluna ser uma
     lista, e não um par de booleanos. */
  const marcados = vaga.campos_compatibilidade ?? [];
  const padrao = marcados.length === 0;
  const conta = (campo: string) => padrao || marcados.includes(campo);

  const criterios: { campo: string; bate: boolean; peso: number; porque: string }[] = [];

  const alvo = normalizar(`${vaga.profession ?? ""} ${vaga.specialty ?? ""} ${vaga.title ?? ""}`);
  const bateFuncao = quem.funcoes.some((f) => {
    const n = normalizar(f);
    /* Nos dois sentidos: "auxiliar de cozinha" no cadastro casa com a
       vaga de "cozinha", e a vaga de "auxiliar de cozinha" casa com quem
       se cadastrou só como "cozinha". Uma comparação de igualdade exata
       perderia as duas. */
    return n.length > 2 && (alvo.includes(n) || n.includes(normalizar(vaga.profession ?? "")));
  });
  criterios.push({ campo: "profissao", bate: bateFuncao, peso: 60, porque: "seu ofício" });

  criterios.push({
    campo: "cidade",
    bate: !!(quem.cidade && vaga.city && normalizar(quem.cidade) === normalizar(vaga.city)),
    peso: 25,
    porque: "sua cidade",
  });

  criterios.push({
    campo: "modo_trabalho",
    /* Sem resposta de um dos lados o critério BATE, e não falha: um campo
       que ninguém preencheu não é uma incompatibilidade, e tratá-lo como
       tal puniria quem deixou o cadastro pela metade. */
    bate:
      !quem.modo ||
      !vaga.work_modality ||
      quem.modo === "tanto_faz" ||
      quem.modo === vaga.work_modality,
    peso: 15,
    porque: "seu jeito de trabalhar",
  });

  /* Os critérios abaixo só entram na conta quando a EMPRESA os marcou.
     Fora disso eles nem aparecem: somá-los sempre faria toda vaga que não
     pede CNH baixar a nota de quem não tem CNH — o que é o contrário do
     que a informação significa. */
  criterios.push({
    campo: "escolaridade",
    bate:
      !vaga.escolaridade_minima ||
      (quem.escolaridade != null &&
        ESCADA_ESCOLARIDADE.indexOf(quem.escolaridade) >=
          ESCADA_ESCOLARIDADE.indexOf(vaga.escolaridade_minima)),
    peso: 20,
    porque: "sua formação",
  });

  criterios.push({
    campo: "cnh",
    bate:
      !vaga.cnh_exigida ||
      (quem.temCnh &&
        (vaga.cnh_categorias.length === 0 ||
          vaga.cnh_categorias.some((c) => quem.cnhCategorias.includes(c)))),
    peso: 20,
    porque: "sua CNH",
  });

  criterios.push({
    campo: "viagem",
    bate: !vaga.exige_viagem || quem.aceitaViajar,
    peso: 15,
    porque: "você aceita viajar",
  });

  criterios.push({
    campo: "inicio_imediato",
    bate: !vaga.available_immediately || quem.inicioImediato,
    peso: 10,
    porque: "você começa logo",
  });

  criterios.push({
    campo: "fim_de_semana",
    bate: vaga.jornada !== "fins_de_semana" || quem.fimDeSemana,
    peso: 10,
    porque: "você topa fim de semana",
  });

  criterios.push({
    campo: "pretensao",
    /* "A combinar" de qualquer um dos lados BATE: os dois disseram que o
       assunto se conversa, e transformar isso em incompatibilidade seria
       inventar um desacordo que ninguém declarou.

       E a comparação é contra o TETO da vaga, não contra o piso: quem pede
       R$ 2.000 numa vaga de "R$ 1.800 a R$ 2.400" cabe. */
    bate:
      quem.pretensaoCombinar ||
      quem.pretensaoCentavos == null ||
      vaga.salario_a_combinar ||
      (vaga.salary_range_max ?? vaga.salary_range_min) == null ||
      quem.pretensaoCentavos <= (vaga.salary_range_max ?? vaga.salary_range_min ?? 0),
    peso: 15,
    porque: "sua pretensão cabe",
  });

  const valendo = criterios.filter((c) => conta(c.campo));
  /* Nenhum critério em jogo é impossível (a lista vazia liga todos), mas a
     divisão por zero não pode depender disso: um valor novo em
     `campos_compatibilidade` que nenhum critério reconheça deixaria
     `valendo` vazio, e a nota viraria NaN — que na tela aparece como
     "NaN%" ou como nada, e ninguém saberia por quê. */
  if (valendo.length === 0) return { nota: null, porque: [] };

  const total = valendo.reduce((soma, c) => soma + c.peso, 0);
  const feito = valendo.filter((c) => c.bate).reduce((soma, c) => soma + c.peso, 0);

  return {
    nota: Math.round((feito / total) * 100),
    porque: valendo.filter((c) => c.bate).map((c) => c.porque),
  };
}

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
  const { data, error } = await sb
    .from("job_listings")
    .select(
      `id, company_id, title, description, profession, specialty,
       required_experience, skills, salary_range_min, salary_range_max,
       available_immediately, work_modality, city, uf, neighborhood,
       anunciada_ate, status, created_at, closed_at,
       tipo_contrato, jornada, beneficios, salario_a_combinar, salario_periodo,
       quantidade_vagas, data_inicio, prazo_candidatura, horario, escala,
       aceita_outras_cidades, comissao, outros_beneficios,
       escolaridade_minima, curso_especifico, cnh_exigida, cnh_categorias,
       exige_viagem, idiomas, observacoes,
       campos_compatibilidade, aceita_sem_compatibilidade,
       companies:companies_public!inner ( company_name, photo_url )`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;

  /* Quem está olhando. A leitura falha? O erro sobe junto: mostrar a lista
     sem compatibilidade nenhuma pareceria "você não combina com nada". */
  let quem: QuemOlha | null = null;
  const respondidas = new Map<string, boolean>();
  if (userId) {
    const { data: p, error: erroPerfil } = await sb
      .from("professionals")
      .select(
        "id, areas_de_interesse, city, modo_trabalho, cnh, cnh_categorias, " +
          "aceita_viajar, inicio_imediato, fim_de_semana, " +
          "pretensao_centavos, pretensao_combinar, disponibilidade"
      )
      .eq("owner_id", userId)
      .maybeSingle();
    if (erroPerfil) throw erroPerfil;
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
    const { nota, porque } = calcular(v as JobListing, quem);
    return {
      vaga: v as JobListing,
      empresa: v.companies?.company_name ?? "",
      empresa_foto: v.companies?.photo_url ?? null,
      compatibilidade: nota,
      porque,
      interessado: respondidas.get(v.id),
    };
  });

  /* Ordena pela compatibilidade quando ela existe, e pela data quando não.
     Quem não tem cadastro vê a lista em ordem cronológica, que é a única
     ordem honesta para quem o app ainda não conhece. */
  if (quem) {
    lista.sort((a, b) => (b.compatibilidade ?? 0) - (a.compatibilidade ?? 0));
  }
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
