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
};

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
function calcular(vaga: JobListing, quem: QuemOlha | null): { nota: number | null; porque: string[] } {
  if (!quem || quem.funcoes.length === 0) return { nota: null, porque: [] };

  const porque: string[] = [];
  let nota = 0;

  const alvo = normalizar(`${vaga.profession ?? ""} ${vaga.specialty ?? ""} ${vaga.title ?? ""}`);
  const bateFuncao = quem.funcoes.some((f) => {
    const n = normalizar(f);
    /* Nos dois sentidos: "auxiliar de cozinha" no cadastro casa com a vaga
       de "cozinha", e a vaga de "auxiliar de cozinha" casa com quem se
       cadastrou só como "cozinha". Uma comparação de igualdade exata
       perderia as duas. */
    return n.length > 2 && (alvo.includes(n) || n.includes(normalizar(vaga.profession ?? "")));
  });
  if (bateFuncao) {
    nota += 60;
    porque.push("seu ofício");
  }

  if (quem.cidade && vaga.city && normalizar(quem.cidade) === normalizar(vaga.city)) {
    nota += 25;
    porque.push("sua cidade");
  }

  if (!quem.modo || !vaga.work_modality || quem.modo === "tanto_faz" || quem.modo === vaga.work_modality) {
    nota += 15;
    if (quem.modo && vaga.work_modality && quem.modo === vaga.work_modality) {
      porque.push("seu jeito de trabalhar");
    }
  }

  return { nota, porque };
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
       tipo_contrato, jornada, beneficios, salario_a_combinar,
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
      .select("id, areas_de_interesse, city")
      .eq("owner_id", userId)
      .maybeSingle();
    if (erroPerfil) throw erroPerfil;
    if (p) {
      const linha = p as { id: string; areas_de_interesse?: string[]; city?: string };
      quem = {
        funcoes: linha.areas_de_interesse ?? [],
        cidade: linha.city ?? "",
        /* `modo_trabalho` é da 0103 e ainda pode não existir no banco.
           Pedi-lo antes da hora derruba a consulta INTEIRA com 42703 e o
           banco de vagas abre vazio — é o mesmo erro da 0060, quando o app
           mandou a coluna `uf` quinze horas antes de ela existir. Entra
           aqui quando a 0103 estiver aplicada. */
        modo: null,
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
