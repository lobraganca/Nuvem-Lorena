import { supabase } from "./supabase";
import { familiasDoTexto } from "./sinonimosDeOficio";

/**
 * O termômetro do emprego: o que a cidade está contratando.
 *
 * A dona: "criar TERMÔMETRO DO EMPREGO. O app poderia mostrar: o que está
 * contratando em Itabirito? Vendas ↑, Construção ↑, Administrativo →,
 * Serviços ↑, Tecnologia ↑."
 *
 * ── De onde saem os números ───────────────────────────────────────────
 *
 * Da função `termometro_do_emprego` (migration 0126), que devolve uma
 * linha por PROFISSÃO com duas contagens: os últimos 30 dias e os 30
 * anteriores. Precisa ser função do banco porque a metade "antes" é feita
 * de vagas já encerradas, que o navegador não tem direito de ler.
 *
 * ── Os setores saem do dicionário de ofícios, e não de uma lista nova ──
 *
 * "Vendas" e "Construção" são grupos de profissões, e o app já sabe
 * agrupar profissão: é o dicionário de `sinonimosDeOficio.ts`, que
 * conhece "atendente de loja" e "vendedor" como a mesma família.
 *
 * Aqui só se diz a que SETOR cada família pertence. Uma lista de famílias
 * por setor, e não uma segunda lista de palavras — senão o termômetro
 * classificaria "auxiliar de cozinha" de um jeito e a onda de vagas de
 * outro, sobre a mesma palavra.
 */

/**
 * Os setores, e as famílias de ofício que caem em cada um.
 *
 * O nome de cada família é a PRIMEIRA palavra da linha dela lá em
 * `sinonimosDeOficio.ts` — é assim que o dicionário identifica a família,
 * e é o que `familiasDoTexto` devolve.
 *
 * A ordem aqui é a ordem da tela. Ela não é alfabética: começa pelo que
 * mais emprega em Itabirito e termina no que menos aparece, porque a
 * pessoa lê as três primeiras linhas e decide se continua.
 */
const SETORES: readonly { nome: string; familias: readonly string[] }[] = [
  {
    nome: "Comércio e vendas",
    familias: ["vendedor", "caixa", "atendente", "estoquista", "telemarketing"],
  },
  {
    nome: "Construção",
    familias: [
      "pedreiro", "servente", "pintor", "eletricista", "encanador", "marceneiro",
      "serralheiro", "vidraceiro", "gesseiro", "marido de aluguel", "montador de moveis",
    ],
  },
  {
    nome: "Comida e eventos",
    familias: [
      "cozinheira", "chapeiro", "garcom", "padeiro", "acougueiro", "confeiteira",
      "salgadeira", "buffet e festas", "dj e som", "decoracao de festas",
    ],
  },
  {
    nome: "Serviços e cuidados",
    familias: [
      "diarista", "passadeira", "cuidador de idosos", "baba", "jardineiro",
      "piscineiro", "dedetizador", "chaveiro", "enfermagem em casa", "banho e tosa",
      "veterinario",
    ],
  },
  {
    nome: "Beleza e bem-estar",
    familias: [
      "cabeleireiro", "barbeiro", "manicure", "depilacao", "maquiadora",
      "estetica e sobrancelhas", "massagista", "personal trainer", "nutricionista",
      "fisioterapeuta", "psicologo",
    ],
  },
  {
    nome: "Escritório e administrativo",
    familias: [
      "auxiliar administrativo", "recepcionista", "contador", "advogado",
      "corretor de imoveis",
    ],
  },
  {
    nome: "Indústria e mineração",
    familias: [
      "auxiliar de producao", "mecanico industrial", "eletricista industrial",
      "operador de empilhadeira",
    ],
  },
  {
    nome: "Transporte e entregas",
    familias: ["motorista", "motoboy", "entregador", "frete e mudancas"],
  },
  {
    nome: "Tecnologia e comunicação",
    familias: [
      "tecnico em informatica", "tecnico em celulares", "designer grafico",
      "social media", "fotografo", "filmagem",
    ],
  },
  {
    nome: "Manutenção e conserto",
    familias: [
      "mecanico", "borracheiro", "lavagem de carros", "funilaria e pintura automotiva",
      "refrigeracao e ar-condicionado", "conserto de eletrodomesticos", "sapateiro",
      "tapeceiro", "costureira",
    ],
  },
  {
    nome: "Ensino",
    familias: [
      "professor particular", "professor de ingles", "professor de musica", "palestrante",
    ],
  },
  {
    nome: "Segurança e portaria",
    familias: ["seguranca e portaria"],
  },
];

/** Da família para o setor, montado uma vez. */
const SETOR_DA_FAMILIA = (() => {
  const mapa = new Map<string, string>();
  for (const s of SETORES) for (const f of s.familias) mapa.set(f, s.nome);
  return mapa;
})();

export type LinhaDoTermometro = {
  setor: string;
  /** Vagas nos últimos 30 dias. */
  agora: number;
  /** Vagas nos 30 dias anteriores a esses. */
  antes: number;
  /** "subiu" | "desceu" | "igual" | "poucas" — ver `MINIMO_PARA_SETA`. */
  tendencia: "subiu" | "desceu" | "igual" | "poucas";
};

/**
 * Abaixo disto o setor aparece sem seta.
 *
 * Numa cidade pequena, duas vagas viram três e a seta diria "subiu 50%".
 * Isso não é tendência, é o acaso de uma padaria ter aberto vaga na
 * semana passada — e publicar isso como movimento do mercado é publicar
 * informação errada sobre a cidade.
 *
 * O setor continua na lista com o número: "3 vagas" é verdade e é útil.
 * O que some é a SETA, que é a parte que afirma uma direção.
 */
export const MINIMO_PARA_SETA = 5;

/**
 * Abaixo disto o setor não aparece.
 *
 * Uma lista de doze setores em que dez dizem "0 vagas" faz a cidade
 * parecer parada — e a leitura certa é outra: aqueles ofícios existem, só
 * não tiveram vaga ANUNCIADA no app neste mês. Mostrar só quem teve
 * movimento diz a verdade sem dar a impressão errada.
 */
const MINIMO_PARA_APARECER = 1;

export type Termometro = {
  linhas: LinhaDoTermometro[];
  /** Total de vagas no período recente, somando tudo — inclusive o que
      não caiu em setor nenhum. */
  totalAgora: number;
};

/**
 * Lê o termômetro. Devolve `null` quando o banco ainda não sabe responder
 * (a 0126 não aplicada) ou quando não há vaga nenhuma no período.
 *
 * `null` e não lista vazia, e a diferença é a de sempre neste app: lista
 * vazia numa tela desenhada faz a tela aparecer dizendo "nada está
 * contratando", que é uma afirmação — e falsa, se o motivo foi a SQL não
 * ter sido colada.
 */
export async function lerTermometro(cidade: string | null = null): Promise<Termometro | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc("termometro_do_emprego", {
    p_dias: 30,
    p_cidade: cidade,
  });

  if (error) {
    const e = error as { code?: string; message?: string };
    const faltaSQL =
      e.code === "42883" ||
      e.code === "PGRST202" ||
      (e.message ?? "").toLowerCase().includes("could not find the function");
    if (faltaSQL) {
      console.warn(
        "[Ei] O termômetro não aparece porque a migration 0126 ainda não foi " +
          "aplicada no banco."
      );
    } else {
      console.error("[Ei] termometro_do_emprego falhou:", error);
    }
    return null;
  }

  const linhas = Array.isArray(data) ? data : [];
  if (linhas.length === 0) return null;

  /* Soma por setor. Profissão que o dicionário não conhece — "operador de
     britador", por exemplo — entra no total geral e não em setor nenhum:
     inventar um setor "Outros" daria a ele um lugar na lista e uma seta,
     como se fosse uma área do mercado. Não é; é uma palavra solta. */
  const porSetor = new Map<string, { agora: number; antes: number }>();
  let totalAgora = 0;

  for (const l of linhas) {
    const agora = Number(l.agora ?? 0);
    const antes = Number(l.antes ?? 0);
    totalAgora += agora;

    const familias = familiasDoTexto(String(l.profissao ?? ""));
    /* Uma profissão pode acender mais de uma família ("cozinheiro e
       chapeiro"). Os setores dela entram num conjunto para a vaga não ser
       contada duas vezes dentro do MESMO setor. */
    const setores = new Set<string>();
    for (const f of familias) {
      const s = SETOR_DA_FAMILIA.get(f);
      if (s) setores.add(s);
    }
    for (const s of setores) {
      const atual = porSetor.get(s) ?? { agora: 0, antes: 0 };
      porSetor.set(s, { agora: atual.agora + agora, antes: atual.antes + antes });
    }
  }

  const ordemDaTela = new Map(SETORES.map((s, i) => [s.nome, i]));
  const resultado: LinhaDoTermometro[] = [...porSetor.entries()]
    .filter(([, n]) => n.agora + n.antes >= MINIMO_PARA_APARECER)
    .map(([setor, n]) => ({
      setor,
      agora: n.agora,
      antes: n.antes,
      tendencia: tendenciaDe(n.agora, n.antes),
    }))
    /* Ordenada pelo movimento, e não pela ordem do código: numa lista de
       doze linhas, o que a pessoa quer ver primeiro é onde há mais vaga
       agora. A ordem do código só desempata. */
    .sort(
      (a, b) =>
        b.agora - a.agora ||
        (ordemDaTela.get(a.setor) ?? 99) - (ordemDaTela.get(b.setor) ?? 99)
    );

  if (resultado.length === 0) return null;
  return { linhas: resultado, totalAgora };
}

/**
 * A seta de um setor.
 *
 * "poucas" quando os dois períodos somados não chegam ao mínimo: aí não
 * há tendência a afirmar, só um número a mostrar.
 *
 * E "igual" não é só empate exato — é qualquer variação de uma vaga.
 * Cinco viraram seis não é o mercado aquecendo.
 */
function tendenciaDe(agora: number, antes: number): LinhaDoTermometro["tendencia"] {
  if (agora + antes < MINIMO_PARA_SETA) return "poucas";
  const diferenca = agora - antes;
  if (diferenca > 1) return "subiu";
  if (diferenca < -1) return "desceu";
  return "igual";
}
