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
): { nota: number | null; porque: string[]; faltou: string[] } {
  if (!quem || quem.funcoes.length === 0) return { nota: null, porque: [], faltou: [] };

  /* ── OS CAMPOS QUE A EMPRESA MARCOU (item 16, coluna da 0105) ───────
     Lista vazia = a empresa não escolheu, e aí vale a comparação padrão:
     função e cidade, que é o que este app sempre fez. É diferente de
     marcar um campo só — e essa diferença é o motivo de a coluna ser uma
     lista, e não um par de booleanos. */
  const marcados = vaga.campos_compatibilidade ?? [];
  const padrao = marcados.length === 0;
  const conta = (campo: string) => padrao || marcados.includes(campo);

  /* ── UM CRITÉRIO SÓ CONTA QUANDO A VAGA PEDE AQUILO — 04/09 ────────
     `vale` é a novidade, e ela conserta um defeito que inflava TODAS as
     notas do app.

     A regra antiga era "campo que ninguém preencheu não pune ninguém":
     o critério da CNH, por exemplo, BATIA quando a vaga não exigia CNH.
     Só que ele batia somando os 20 pontos dele — e o mesmo valia para
     viagem, início imediato, fim de semana, escolaridade e pretensão.

     O efeito, medido: uma manicure de OUTRA cidade tirava 47% numa vaga
     de pedreiro. Quarenta e sete por cento é a faixa da onda 2 ("quem
     combina em boa parte"), então a vaga de pedreiro era oferecida a ela
     — e a tela dizia "combina em parte" para todo mundo do app.

     Não punir continua valendo; o que muda é COMO: o critério que a vaga
     não pede sai da conta inteira, em vez de entrar como acerto. Quem não
     tem CNH não perde ponto numa vaga que não pede CNH, e também não
     ganha. */
  const criterios: {
    campo: string;
    bate: boolean;
    peso: number;
    porque: string;
    /** A vaga pede este critério? Quando não, ele não entra na conta. */
    vale?: boolean;
  }[] = [];

  const alvo = normalizar(`${vaga.profession ?? ""} ${vaga.specialty ?? ""} ${vaga.title ?? ""}`);
  const bateFuncao = quem.funcoes.some((f) => {
    const n = normalizar(f);
    /* Nos dois sentidos: "auxiliar de cozinha" no cadastro casa com a
       vaga de "cozinha", e a vaga de "auxiliar de cozinha" casa com quem
       se cadastrou só como "cozinha". Uma comparação de igualdade exata
       perderia as duas. */
    return n.length > 2 && (alvo.includes(n) || n.includes(normalizar(vaga.profession ?? "")));
  });
  /* O ofício conta SEMPRE, marcado ou não.
     ────────────────────────────────────
     Antes ele obedecia à marcação como os outros, e isso abria um buraco
     grande: uma vaga de pedreiro que marcasse só "CNH" dava 100% para uma
     manicure com carteira de motorista — e a onda 1, que é a que a
     empresa dispara primeiro, avisava justamente essa pessoa.

     Marcar campos serve para dizer o que MAIS pesa, não para desligar o
     ofício: uma vaga sem ofício não é uma vaga, é um convite aberto. */
  criterios.push({ campo: "profissao", bate: bateFuncao, peso: 60, porque: "seu ofício", vale: true });

  criterios.push({
    campo: "cidade",
    bate: !!(quem.cidade && vaga.city && normalizar(quem.cidade) === normalizar(vaga.city)),
    peso: 25,
    porque: "sua cidade",
    /* Os dois lados sempre têm cidade (o cadastro e a vaga são da
       cidade), então este critério sempre pode ser respondido. */
    vale: !!(quem.cidade && vaga.city),
  });

  criterios.push({
    campo: "modo_trabalho",
    /* Sem resposta de um dos lados o critério BATE, e não falha: um campo
       que ninguém preencheu não é uma incompatibilidade, e tratá-lo como
       tal puniria quem deixou o cadastro pela metade. */
    bate: quem.modo === "tanto_faz" || quem.modo === vaga.work_modality,
    peso: 15,
    porque: "seu jeito de trabalhar",
    /* Só entra quando os DOIS responderam. Antes, o silêncio de qualquer
       um dos lados fazia o critério bater e somar 15 pontos de graça. */
    vale: !!quem.modo && !!vaga.work_modality,
  });

  /* Os critérios abaixo só entram na conta quando a EMPRESA os marcou.
     Fora disso eles nem aparecem: somá-los sempre faria toda vaga que não
     pede CNH baixar a nota de quem não tem CNH — o que é o contrário do
     que a informação significa. */
  criterios.push({
    campo: "escolaridade",
    bate:
      quem.escolaridade != null &&
      vaga.escolaridade_minima != null &&
      ESCADA_ESCOLARIDADE.indexOf(quem.escolaridade) >=
        ESCADA_ESCOLARIDADE.indexOf(vaga.escolaridade_minima),
    peso: 20,
    porque: "sua formação",
    vale: !!vaga.escolaridade_minima,
  });

  criterios.push({
    campo: "cnh",
    bate:
      quem.temCnh &&
      (vaga.cnh_categorias.length === 0 ||
        vaga.cnh_categorias.some((c) => quem.cnhCategorias.includes(c))),
    peso: 20,
    porque: "sua CNH",
    vale: !!vaga.cnh_exigida,
  });

  criterios.push({
    campo: "viagem",
    bate: quem.aceitaViajar,
    peso: 15,
    porque: "você aceita viajar",
    vale: !!vaga.exige_viagem,
  });

  criterios.push({
    campo: "inicio_imediato",
    bate: quem.inicioImediato,
    peso: 10,
    porque: "você começa logo",
    vale: !!vaga.available_immediately,
  });

  criterios.push({
    campo: "fim_de_semana",
    bate: quem.fimDeSemana,
    peso: 10,
    porque: "você topa fim de semana",
    vale: vaga.jornada === "fins_de_semana",
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
      vaga.salario_a_combinar ||
      (quem.pretensaoCentavos != null &&
        quem.pretensaoCentavos <= (vaga.salary_range_max ?? vaga.salary_range_min ?? 0)),
    peso: 15,
    porque: "sua pretensão cabe",
    /* Só quando os dois falaram de dinheiro. Se a vaga não diz salário e
       a pessoa não diz pretensão, não há nada para comparar — e somar
       quinze pontos por esse silêncio era parte do que inflava a nota. */
    vale:
      (vaga.salario_a_combinar ||
        (vaga.salary_range_max ?? vaga.salary_range_min) != null) &&
      (quem.pretensaoCombinar || quem.pretensaoCentavos != null),
  });

  /* Entra na conta o que a vaga PEDE (`vale`) e o que a empresa marcou
     como importante (`conta`). O ofício é a exceção que já vem marcada:
     ele conta sempre. */
  const valendo = criterios.filter(
    (c) => c.vale !== false && (c.campo === "profissao" || conta(c.campo))
  );
  /* Nenhum critério em jogo é impossível (a lista vazia liga todos), mas a
     divisão por zero não pode depender disso: um valor novo em
     `campos_compatibilidade` que nenhum critério reconheça deixaria
     `valendo` vazio, e a nota viraria NaN — que na tela aparece como
     "NaN%" ou como nada, e ninguém saberia por quê. */
  if (valendo.length === 0) return { nota: null, porque: [], faltou: [] };

  const total = valendo.reduce((soma, c) => soma + c.peso, 0);
  const feito = valendo.filter((c) => c.bate).reduce((soma, c) => soma + c.peso, 0);

  return {
    nota: Math.round((feito / total) * 100),
    porque: valendo.filter((c) => c.bate).map((c) => c.porque),
    /* ── O QUE FALTOU, E POR QUE ELE SAI DAQUI — 04/09 ─────────────────
       `porque` sempre disse o que casou. O que NÃO casou nunca saiu desta
       função, e sem isso a única resposta que o app tinha para "por que
       ninguém me chama?" era um conselho igual para todo mundo
       ("acrescente mais funções").

       Com a lista do que faltou, a tela de desempenho pode contar nas
       vagas que estão no ar HOJE: "seis vagas pedem CNH e o seu cadastro
       diz que você não tem". Isso é diagnóstico, não conselho — e sai de
       graça, porque a conta já sabia a resposta e a jogava fora.

       Vai por CAMPO (`cnh`, `escolaridade`), e não pela frase de
       `porque`: quem soma precisa agrupar, e agrupar por frase quebra na
       primeira vez que alguém reescrever o texto. */
    faltou: valendo.filter((c) => !c.bate).map((c) => c.campo),
  };
}

