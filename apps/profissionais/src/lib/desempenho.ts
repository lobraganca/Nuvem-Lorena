import { supabase } from "./supabase";
import { lerTudo } from "./lerTudo";
import { bancoDeVagas } from "./bancoDeVagas";
import { FAIXAS_DAS_ONDAS } from "../types/domain";

/**
 * Como o cadastro desta pessoa está indo.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "dentro do módulo do empregado, ter uma opção de métricas onde
 * mostra por exemplo: seu perfil apareceu para 8 empresas esta semana;
 * você apareceu em 14 buscas; você está entre os profissionais mais
 * compatíveis para 3 oportunidades. Mensagens motivacionais."
 *
 * ── Por que isto vale mais do que parece ───────────────────────────────
 *
 * Quem procura trabalho passa semanas sem sinal nenhum. O cadastro está
 * lá, respondeu a duas vagas, e daí em diante é silêncio — que a pessoa
 * lê como "não estou servindo para nada". A maioria some do app nesse
 * ponto, e some calada.
 *
 * Três números honestos dizem o contrário: o app está funcionando, você
 * está sendo vista, e falta pouco. Nenhum deles promete emprego, e nenhum
 * deve.
 *
 * ── De onde vem cada um ────────────────────────────────────────────────
 *
 *   empresas que abriram seu cadastro  →  `profile_views` (0106)
 *   buscas em que você apareceu        →  `aparicoes_em_busca` (0114)
 *   vagas em que você é das que mais
 *     combinam                         →  a mesma conta da onda,
 *                                         feita aqui com as vagas no ar
 *
 * ── Erro SOBE ──────────────────────────────────────────────────────────
 *
 * Zero é uma resposta legítima e triste ("ninguém te viu esta semana").
 * Devolver zero porque a consulta falhou seria dar essa notícia sem ela
 * ser verdade — e nesta tela, mais do que em qualquer outra, isso é a
 * diferença entre a pessoa continuar tentando e desistir.
 */

export type Desempenho = {
  /** Empresas diferentes que abriram seu cadastro nos últimos 7 dias. */
  empresasNaSemana: number;
  /** Desde sempre. */
  empresasTotal: number;
  /** Vezes que você apareceu numa busca nos últimos 7 dias. */
  buscasNaSemana: number;
  /** Vagas no ar em que você está na faixa da onda 1 (80% a 100%). */
  vagasMuitoCompativeis: number;
  /** Vagas no ar hoje, para o número acima ter tamanho. */
  vagasNoAr: number;
  /** Vagas em que você já disse que tem interesse. */
  interessesEnviados: number;
};

const SETE_DIAS = 7 * 86_400_000;

export async function meuDesempenho(
  userId: string,
  professionalId: string
): Promise<Desempenho> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const agora = Date.now();
  const desde = new Date(agora - SETE_DIAS).toISOString();

  /* Quem abriu o cadastro. `company_id` nulo é visita anônima do outro
     produto (ver 0106) e não conta: a frase promete EMPRESAS. */
  const { data: visitas, error: erroVisitas } = await sb
    .from("profile_views")
    .select("company_id, viewed_at")
    .eq("professional_id", professionalId)
    .not("company_id", "is", null);
  if (erroVisitas) throw erroVisitas;

  const empresas = new Set<string>();
  const empresasSemana = new Set<string>();
  for (const v of (visitas ?? []) as { company_id: string; viewed_at: string }[]) {
    empresas.add(v.company_id);
    if (v.viewed_at >= desde) empresasSemana.add(v.company_id);
  }

  /* As aparições em busca. `lerTudo` porque são uma linha por dia e a
     0062 corta qualquer consulta em 200 — o que só apareceria depois de
     sete meses de app, que é justamente quando ninguém mais lembra. */
  const aparicoes = (await lerTudo(() =>
    sb
      .from("aparicoes_em_busca")
      .select("dia, vezes")
      .eq("professional_id", professionalId)
  )) as { dia: string; vezes: number }[];

  const diaLimite = new Date(agora - SETE_DIAS).toISOString().slice(0, 10);
  const buscasNaSemana = aparicoes
    .filter((a) => a.dia >= diaLimite)
    .reduce((soma, a) => soma + (a.vezes ?? 0), 0);

  /* As vagas, com a compatibilidade já calculada — a mesma conta da onda
     e da tela do banco de vagas. */
  const vagas = await bancoDeVagas(userId);
  const vagasMuitoCompativeis = vagas.filter(
    (v) => (v.compatibilidade ?? -1) >= FAIXAS_DAS_ONDAS[1].de
  ).length;
  const interessesEnviados = vagas.filter((v) => v.interessado === true).length;

  return {
    empresasNaSemana: empresasSemana.size,
    empresasTotal: empresas.size,
    buscasNaSemana,
    vagasMuitoCompativeis,
    vagasNoAr: vagas.length,
    interessesEnviados,
  };
}

/**
 * A frase de incentivo — escolhida pelos números, nunca sorteada.
 *
 * A dona pediu "mensagens motivacionais". Frase genérica de motivação
 * ("acredite em você!") numa tela de quem está desempregado é ofensa
 * educada: ela não sabe nada sobre a pessoa e promete o que não pode.
 *
 * Cada frase daqui é uma leitura HONESTA do número que está do lado, e
 * quase todas terminam num passo que a pessoa pode dar hoje. A única que
 * não termina em tarefa é a de quem está indo bem — porque aí o passo
 * certo é esperar.
 */
export function recadoDoDesempenho(d: Desempenho): { titulo: string; texto: string } {
  if (d.empresasNaSemana >= 3) {
    return {
      titulo: `${d.empresasNaSemana} empresas abriram seu cadastro esta semana`,
      texto:
        "Seu cadastro está circulando. Deixe o telefone à mão — quando a empresa abre, é porque já está pensando em ligar.",
    };
  }

  if (d.vagasMuitoCompativeis > 0) {
    return {
      titulo: `Você é das que mais combinam em ${d.vagasMuitoCompativeis} ${
        d.vagasMuitoCompativeis === 1 ? "vaga" : "vagas"
      }`,
      texto:
        "Não espere a empresa te achar: abra essas vagas e toque em “tenho interesse”. Quem responde aparece primeiro na lista dela.",
    };
  }

  if (d.buscasNaSemana > 0) {
    return {
      titulo: `Você apareceu em ${d.buscasNaSemana} ${
        d.buscasNaSemana === 1 ? "busca" : "buscas"
      } esta semana`,
      texto:
        "Aparecer é metade do caminho. Uma foto e um resumo curto de você fazem a empresa parar na sua linha em vez de rolar.",
    };
  }

  if (d.vagasNoAr === 0) {
    return {
      titulo: "Ainda não há vagas no ar hoje",
      texto:
        "Não é você: nenhuma empresa publicou nada agora. Deixe seu cadastro preenchido, que a vaga nova avisa quem combina.",
    };
  }

  return {
    titulo: "Seu cadastro ainda está passando despercebido",
    texto:
      "Duas coisas mudam isso rápido: acrescentar mais funções que você aceita fazer, e escrever um resumo curto de você. É por essas duas que a busca encontra.",
  };
}
