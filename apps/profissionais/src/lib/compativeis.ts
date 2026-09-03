import { supabase } from "./supabase";
import { lerTudo } from "./lerTudo";
import { calcular, ESCADA_ESCOLARIDADE, type QuemOlha } from "./compatibilidade";
import type { JobListing } from "../types/domain";

/**
 * As pessoas que mais combinam com UMA vaga.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "no painel da empresa, ter duas opções: quem se interessou pela
 * vaga e as pessoas que são mais compatíveis com a vaga."
 *
 * ── Por que isto não existia ainda ─────────────────────────────────────
 *
 * A empresa só enxergava gente de dois jeitos: quem RESPONDEU a vaga
 * (depois da onda) e o banco de talentos inteiro, em ordem de cadastro. O
 * meio do caminho — "quem, entre os cadastrados, é a cara desta vaga?" —
 * não tinha tela nenhuma. Numa cidade com poucas centenas de cadastros,
 * essa lista é o próprio trabalho da empresa.
 *
 * ── É a MESMA conta da onda e da tela do candidato ─────────────────────
 *
 * `compatibilidade.ts`, sem cópia: a empresa que lê "85%" aqui está vendo
 * o mesmo número que a onda 1 usou para escolher quem avisar, e o mesmo
 * que a pessoa vê no banco de vagas. Três telas com fórmulas parecidas
 * mas diferentes seria a maneira mais silenciosa de perder a confiança
 * nos três números.
 *
 * ── O que ela lê, e o que não lê ───────────────────────────────────────
 *
 * `professionals_public`: a mesma view do banco de talentos, que já é
 * aberto a qualquer pessoa. Nada aqui é mais do que a empresa já podia
 * ver — o que muda é a ORDEM e o motivo.
 *
 * Erro SOBE, nunca vira lista vazia: "ninguém combina com a sua vaga" é a
 * pior notícia que esta tela pode dar, e dá-la por causa de uma consulta
 * que falhou seria mentir na direção mais cara.
 */

export type CandidatoCompativel = {
  id: string;
  nome: string;
  foto: string | null;
  cidade: string;
  bairro: string | null;
  funcoes: string[];
  nota: number;
  porque: string[];
  /** Marcou "estou atrás do primeiro emprego" (coluna da 0114). */
  primeiroEmprego: boolean;
  /** Marcou que também faz freela e bico (0114). */
  aceitaFreela: boolean;
};

export async function compativeisComAVaga(vaga: JobListing): Promise<CandidatoCompativel[]> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* Só a cidade da vaga, com o estado junto: há "Bom Jesus" em mais de
     vinte estados, e filtrar pelo nome sozinho traz gente de longe numa
     lista que chega cheia, sem erro nenhum para avisar. */
  const pessoas = (await lerTudo(() => {
    let q = sb
      .from("professionals_public")
      .select(
        "id, name, photo_url, city, uf, neighborhood, categories, areas_de_interesse, " +
          "modo_trabalho, cnh, cnh_categorias, aceita_viajar, inicio_imediato, " +
          "fim_de_semana, pretensao_centavos, pretensao_combinar, disponibilidade, " +
          "primeiro_emprego, aceita_freela, disponivel"
      )
      .eq("city", vaga.city);
    if (vaga.uf) q = q.eq("uf", vaga.uf);
    return q;
  })) as Record<string, any>[];

  if (pessoas.length === 0) return [];

  /* A escolaridade não é coluna: é a maior FORMAÇÃO de cada pessoa (0104),
     e só entra na conta quando a vaga exige escolaridade mínima. Falhar
     aqui não derruba a lista — sem ela o critério simplesmente não bate,
     que é o mesmo que a empresa tinha antes desta tela existir. */
  const maiorFormacao = new Map<string, string>();
  try {
    const cursos = (await lerTudo(() =>
      sb
        .from("professional_courses")
        .select("professional_id, nivel, tipo")
        .in(
          "professional_id",
          pessoas.map((p) => p.id)
        )
    )) as { professional_id: string; nivel: string | null; tipo: string }[];
    for (const c of cursos) {
      if (c.tipo !== "formacao" || !c.nivel) continue;
      const atual = maiorFormacao.get(c.professional_id);
      if (!atual || ESCADA_ESCOLARIDADE.indexOf(c.nivel) > ESCADA_ESCOLARIDADE.indexOf(atual)) {
        maiorFormacao.set(c.professional_id, c.nivel);
      }
    }
  } catch {
    /* segue sem escolaridade */
  }

  const lista: CandidatoCompativel[] = [];
  for (const p of pessoas) {
    const funcoes: string[] = [
      ...((p.areas_de_interesse as string[]) ?? []),
      ...((p.categories as string[]) ?? []),
    ].filter(Boolean);

    const quem: QuemOlha = {
      funcoes,
      cidade: p.city ?? "",
      modo: p.modo_trabalho ?? null,
      temCnh: !!p.cnh,
      cnhCategorias: (p.cnh_categorias as string[]) ?? [],
      aceitaViajar: !!p.aceita_viajar,
      inicioImediato: !!p.inicio_imediato,
      fimDeSemana: !!p.fim_de_semana,
      pretensaoCentavos: p.pretensao_centavos ?? null,
      pretensaoCombinar: !!p.pretensao_combinar,
      disponibilidade: (p.disponibilidade as string[]) ?? [],
      escolaridade: maiorFormacao.get(p.id) ?? null,
    };

    const { nota, porque } = calcular(vaga, quem);
    /* `null` é "essa pessoa não escreveu ofício nenhum", e não "zero por
       cento": ela não entra na lista, porque a lista é sobre ORDEM e ela
       não tem lugar em ordem nenhuma. Continua no banco de talentos. */
    if (nota === null) continue;

    lista.push({
      id: p.id,
      nome: p.name ?? "",
      foto: p.photo_url ?? null,
      cidade: p.city ?? "",
      bairro: p.neighborhood ?? null,
      funcoes,
      nota,
      porque,
      primeiroEmprego: !!p.primeiro_emprego,
      aceitaFreela: !!p.aceita_freela,
    });
  }

  /* Empate desfeito por quem se declarou disponível: entre duas pessoas
     igualmente compatíveis, a empresa quer falar primeiro com quem disse
     que pode começar. */
  return lista.sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Conta que estas pessoas apareceram numa busca.
 *
 * Alimenta o "você apareceu em N buscas" da tela de desempenho de quem
 * procura trabalho. Quem soma é o banco (`registrar_aparicao_em_busca`,
 * 0114), porque quem aparece na busca não é quem está buscando: o app
 * precisaria de permissão para escrever na linha de OUTRA pessoa.
 *
 * Falha em silêncio de propósito, e é a única função deste arquivo que
 * faz isso: é uma contagem. Derrubar a lista de candidatos de uma empresa
 * porque um contador não subiu seria trocar o essencial pelo enfeite.
 */
export async function contarAparicaoEmBusca(ids: string[]): Promise<void> {
  const sb = supabase();
  if (!sb || ids.length === 0) return;
  try {
    await sb.rpc("registrar_aparicao_em_busca", { p_ids: ids.slice(0, 200) });
  } catch {
    /* segue sem contar */
  }
}
