import type { JobListing } from "../types/domain";

/**
 * A conta de compatibilidade entre uma VAGA e um CADASTRO — de 0 a 100.
 *
 * ── Por que ela saiu do banco de vagas ────────────────────────────────
 *
 * Ela nasceu dentro de `bancoDeVagas.ts`, servindo a uma tela só: ordenar
 * as vagas de quem procura trabalho. Em 03/09 a dona redesenhou as ondas
 * de disparo em cima dela — "onda 1: 80% a 100%; onda 2: 40% a 79%; onda
 * 3: 0 a 39" —, e a mesma conta passou a decidir também QUEM é avisado.
 *
 * Duas cópias da fórmula seria o pior arranjo possível: a tela diria 82% e
 * a onda trataria a pessoa como 60%, e ninguém teria como perceber. Aqui
 * ela é uma só, e quem mudar a fórmula muda os dois lados junto.
 *
 * A dona: "a compatibilidade vou planejar posteriormente." Então os pesos
 * abaixo são os de hoje, não os definitivos — e é justamente por isso que
 * eles ficam num arquivo com este nome, e não espalhados.
 *
 * ── O que a conta é, e o que ela não é ────────────────────────────────
 *
 * É um palpite sobre texto que as pessoas escreveram. Serve para ORDENAR
 * a atenção, nunca para fechar porta: barrar por palpite descarta quem não
 * se descreveu direito — e essa pessoa costuma ser quem mais precisa.
 */

/**
 * O cadastro, na forma que a conta precisa.
 *
 * É o mesmo formato dos dois lados: a tela de quem procura monta um a
 * partir do próprio cadastro; a onda monta um por candidato, com o que a
 * função do banco devolve (sem nome e sem telefone).
 */
export type QuemOlha = {
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
export const ESCADA_ESCOLARIDADE = [
  "fundamental",
  "medio",
  "tecnico",
  "superior",
  "pos",
  "mestrado",
  "doutorado",
];

export function normalizar(t: string): string {
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
export function calcular(
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

