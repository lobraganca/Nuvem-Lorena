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
  /** O que, no cadastro, está tirando esta pessoa das vagas de hoje. */
  pontosFracos: PontoFraco[];
};

/**
 * Uma coisa do cadastro que está custando vagas AGORA.
 *
 * ── Por que isto existe ────────────────────────────────────────────────
 *
 * A tela terminava em três conselhos iguais para todo mundo: acrescente
 * funções, passe pelas vagas, apareça primeiro. Todos verdadeiros, nenhum
 * sobre a pessoa que está lendo.
 *
 * A conta de compatibilidade sabia a resposta certa o tempo todo e a
 * jogava fora: ela sabe, vaga por vaga, QUAL critério não bateu. Somando
 * isso nas vagas que estão no ar hoje, o app deixa de aconselhar e passa a
 * informar: "seis das dez vagas de hoje pedem CNH". A pessoa decide o que
 * fazer com o número — e agora tem um.
 *
 * ── O cuidado ──────────────────────────────────────────────────────────
 *
 * Nenhum texto daqui manda a pessoa mentir nem sugere que ela "devia" ter
 * a coisa. Metade destes campos é um SIM/NÃO que ninguém preencheu — o
 * cadastro respondeu "não" por omissão —, e é exatamente esse o caso em
 * que dizer o número muda alguma coisa.
 */
export type PontoFraco = {
  /** O campo da conta de compatibilidade: `cnh`, `escolaridade`, … */
  campo: string;
  /** Em quantas vagas no ar hoje ele pesou. */
  vagas: number;
  titulo: string;
  texto: string;
};

/* O texto de cada campo. Fica numa tabela e não espalhado em `if`s porque
   a lista de critérios cresce (a 0105 acrescentou quatro), e um campo novo
   sem texto tem de sumir da tela em silêncio — nunca aparecer com o nome
   técnico da coluna para a pessoa ler. */
const COMO_EXPLICAR: Record<string, { titulo: (n: number) => string; texto: string }> = {
  cnh: {
    titulo: (n) => `${n} ${n === 1 ? "vaga pede" : "vagas pedem"} CNH`,
    texto:
      "Seu cadastro está marcado como sem carteira de motorista. Se você tem, vale marcar — e dizer as categorias.",
  },
  escolaridade: {
    titulo: (n) => `${n} ${n === 1 ? "vaga pede" : "vagas pedem"} uma escolaridade mínima`,
    texto:
      "Seu cadastro não diz até onde você estudou. Sem isso, a busca não tem como saber que você atende.",
  },
  fim_de_semana: {
    titulo: (n) => `${n} ${n === 1 ? "vaga é" : "vagas são"} de fim de semana`,
    texto:
      "Seu cadastro diz que você não trabalha sábado e domingo. Se topa, é um toque para mudar.",
  },
  viagem: {
    titulo: (n) => `${n} ${n === 1 ? "vaga exige" : "vagas exigem"} viajar`,
    texto: "Seu cadastro diz que você não aceita viagem. Se aceita, marque.",
  },
  inicio_imediato: {
    titulo: (n) => `${n} ${n === 1 ? "vaga é" : "vagas são"} para começar logo`,
    texto:
      "Seu cadastro não diz que você pode começar de imediato — e é o que essas empresas estão procurando.",
  },
  modo_trabalho: {
    titulo: (n) => `${n} ${n === 1 ? "vaga tem" : "vagas têm"} um jeito de trabalhar que não bate`,
    texto:
      "Presencial, a distância ou os dois: quem marca “tanto faz” entra em todas.",
  },
  cidade: {
    titulo: (n) => `${n} ${n === 1 ? "vaga é" : "vagas são"} de outra cidade`,
    texto: "Elas continuam abertas para você — só não são as que mais combinam.",
  },
  pretensao: {
    titulo: (n) => `Em ${n} ${n === 1 ? "vaga" : "vagas"} a sua pretensão passa do que a empresa oferece`,
    texto:
      "Marcar “a combinar” deixa a conversa acontecer, em vez de o número fechar a porta antes dela.",
  },
  /* `profissao` fica de fora de propósito: "sua função não bate com 9
     vagas" é o normal de qualquer cidade — ninguém faz nove ofícios — e
     apareceria em primeiro lugar para todo mundo, empurrando para baixo os
     campos que a pessoa realmente pode resolver hoje. O conselho de
     acrescentar funções continua onde estava, na lista de baixo. */
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

  /* Soma, campo a campo, em quantas vagas no ar ele não bateu. Só entram
     as vagas que a conta conseguiu avaliar (`compatibilidade` não nula):
     quem ainda não tem cadastro não recebe diagnóstico nenhum, porque não
     há o que diagnosticar. */
  const quantasPorCampo = new Map<string, number>();
  for (const v of vagas) {
    if (v.compatibilidade == null) continue;
    for (const campo of v.faltou ?? []) {
      quantasPorCampo.set(campo, (quantasPorCampo.get(campo) ?? 0) + 1);
    }
  }

  const pontosFracos: PontoFraco[] = [...quantasPorCampo.entries()]
    .filter(([campo]) => COMO_EXPLICAR[campo])
    .map(([campo, quantas]) => ({
      campo,
      vagas: quantas,
      titulo: COMO_EXPLICAR[campo].titulo(quantas),
      texto: COMO_EXPLICAR[campo].texto,
    }))
    /* Da que custa mais vagas para a que custa menos, e no máximo três: a
       lista inteira viraria uma lista de defeitos da pessoa, que é o
       oposto do que esta tela serve para fazer. */
    .sort((a, b) => b.vagas - a.vagas)
    .slice(0, 3);

  return {
    empresasNaSemana: empresasSemana.size,
    empresasTotal: empresas.size,
    buscasNaSemana,
    vagasMuitoCompativeis,
    vagasNoAr: vagas.length,
    interessesEnviados,
    pontosFracos,
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
export function recadoDoDesempenho(d: Desempenho): {
  titulo: string;
  texto: string;
  /* O desenho que acompanha o recado — ver `IconesInicio`. */
  icone: "olho" | "alvo" | "lupa" | "sino" | "maleta";
  /* ── UM RECADO QUE MANDA FAZER PRECISA DO BOTÃO — 05/09 ─────────────
     A dona, sobre "Abra e toque em 'tenho interesse'": "ficou horrível."

     E o problema não era só a frase. O recado DIZIA o que fazer e não
     tinha como fazer: um parágrafo de instrução dentro de um quadro
     branco, e a pessoa que quisesse obedecer tinha de sair procurando a
     tela. Instrução sem botão é a forma mais cansativa de dar uma ordem.

     Agora cada recado carrega para ONDE ele leva, e a frase encolheu para
     o que sobra depois de o botão existir. */
  acao?: { texto: string; para: string };
  /* Este recado é sobre SER VISTA? Então o destaque pago resolve
     exatamente o que ele descreve, e o caminho para comprá-lo tem de
     estar ali — não no fim da tela, três seções abaixo, onde a dona não
     achou. Só os recados de visibilidade marcam isto: oferecer o pago em
     "3 empresas abriram seu cadastro" seria vender remédio a quem não
     está doente. */
  ofereceDestaque?: boolean;
} {
  if (d.empresasNaSemana >= 3) {
    return {
      titulo: `${d.empresasNaSemana} empresas abriram seu cadastro esta semana`,
      /* Encurtados em 04/09 ("muita confusão e escrita extensa") e de novo
         em 05/09, quando o botão passou a existir e a frase deixou de
         precisar explicar o caminho. */
      texto: "Quem abre um cadastro está pensando em ligar. Telefone à mão.",
      icone: "olho",
      acao: { texto: "Ver meu cadastro", para: "/meu-perfil" },
    };
  }

  if (d.vagasMuitoCompativeis > 0) {
    return {
      titulo: `Você é das que mais combinam em ${d.vagasMuitoCompativeis} ${
        d.vagasMuitoCompativeis === 1 ? "vaga" : "vagas"
      }`,
      /* A frase dizia "Abra e toque em 'tenho interesse': é assim que seu
         nome e telefone chegam à empresa" — um manual de duas linhas para
         um botão que agora está logo abaixo. Antes disso ela dizia "quem
         responde aparece primeiro na lista dela", que era falso e ainda
         por cima usava o nome do que o app vende. */
      texto: "Responda e a empresa recebe seu nome e telefone.",
      icone: "alvo",
      acao: { texto: "Ver a vaga", para: "/vagas-para-mim" },
    };
  }

  if (d.buscasNaSemana > 0) {
    return {
      titulo: `Você apareceu em ${d.buscasNaSemana} ${
        d.buscasNaSemana === 1 ? "busca" : "buscas"
      } esta semana`,
      texto: "Uma foto e um resumo curto fazem a empresa parar na sua linha.",
      icone: "lupa",
      acao: { texto: "Melhorar meu cadastro", para: "/meu-perfil" },
      ofereceDestaque: true,
    };
  }

  if (d.vagasNoAr === 0) {
    return {
      titulo: "Ainda não há vagas no ar hoje",
      texto: "Não é você: ninguém publicou nada hoje. A vaga nova te avisa.",
      icone: "sino",
      acao: { texto: "Conferir meus avisos", para: "/avisos" },
    };
  }

  return {
    titulo: "Seu cadastro ainda está passando despercebido",
    texto: "Mais funções marcadas e um resumo curto: é por eles que a busca encontra.",
    icone: "maleta",
    acao: { texto: "Completar meu cadastro", para: "/meu-perfil" },
    ofereceDestaque: true,
  };
}
