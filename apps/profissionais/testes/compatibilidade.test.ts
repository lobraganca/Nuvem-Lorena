/**
 * A conta que decide quem é avisado de uma vaga.
 *
 * É a regra mais importante do app e a que ninguém nunca tinha testado:
 * ela ordena o banco de vagas de quem procura, escolhe quem cada onda
 * alcança e monta a lista de candidatos da empresa. Errar aqui não
 * quebra tela nenhuma — só faz o app avisar as pessoas erradas, em
 * silêncio.
 */
import { calcular, normalizar, ESCADA_ESCOLARIDADE, type QuemOlha } from "../src/lib/compatibilidade.ts";
import type { JobListing } from "../src/types/domain.ts";
import { grupo, teste, igual, verdade, entre, resumo } from "./ajuda.ts";

/** Uma vaga com o mínimo, para cada teste mudar só o que interessa. */
function vaga(mudancas: Partial<JobListing> = {}): JobListing {
  return {
    id: "v1",
    company_id: "e1",
    title: "Pedreiro",
    description: "",
    profession: "Pedreiro",
    specialty: null,
    required_experience: null,
    skills: [],
    salary_range_min: null,
    salary_range_max: null,
    available_immediately: false,
    work_modality: "presencial",
    city: "Itabirito",
    uf: "MG",
    neighborhood: null,
    anunciada_ate: null,
    status: "active",
    created_at: new Date().toISOString(),
    closed_at: null,
    tipo_contrato: null,
    jornada: null,
    beneficios: [],
    salario_a_combinar: false,
    salario_periodo: "mes",
    quantidade_vagas: 1,
    data_inicio: null,
    prazo_candidatura: null,
    horario: null,
    escala: null,
    aceita_outras_cidades: false,
    comissao: null,
    outros_beneficios: null,
    escolaridade_minima: null,
    curso_especifico: null,
    cnh_exigida: false,
    cnh_categorias: [],
    exige_viagem: false,
    idiomas: [],
    observacoes: null,
    campos_compatibilidade: [],
    aceita_sem_compatibilidade: true,
    aceita_primeiro_emprego: false,
    vaga_para_pcd: false,
    destaque_ate: null,
    ...mudancas,
  } as JobListing;
}

function quem(mudancas: Partial<QuemOlha> = {}): QuemOlha {
  return {
    funcoes: ["Pedreiro"],
    cidade: "Itabirito",
    modo: "presencial",
    temCnh: false,
    cnhCategorias: [],
    aceitaViajar: false,
    inicioImediato: false,
    fimDeSemana: false,
    pretensaoCentavos: null,
    pretensaoCombinar: false,
    disponibilidade: [],
    escolaridade: null,
    ...mudancas,
  };
}

grupo("o que a conta responde quando não sabe");

teste("sem cadastro nenhum, a nota é 'não sei' e não zero", () => {
  igual(calcular(vaga(), null).nota, null);
});

teste("cadastro sem nenhuma função também é 'não sei'", () => {
  igual(calcular(vaga(), quem({ funcoes: [] })).nota, null);
});

grupo("o ofício, que é o que decide se a conversa começa");

teste("mesmo ofício na mesma cidade dá 100", () => {
  igual(calcular(vaga(), quem()).nota, 100);
});

teste("ofício diferente derruba a nota abaixo da onda 1", () => {
  const { nota } = calcular(vaga(), quem({ funcoes: ["Manicure"] }));
  verdade(nota !== null && nota < 80, `esperava menos de 80, veio ${nota}`);
});

teste("acento e maiúscula não separam a mesma palavra", () => {
  igual(normalizar("Eletricista Predial"), "eletricista predial");
  igual(
    calcular(vaga({ profession: "Mecânico" }), quem({ funcoes: ["mecanico"] })).nota,
    100
  );
});

teste("'auxiliar de cozinha' casa com a vaga de 'cozinha', e o contrário também", () => {
  igual(calcular(vaga({ profession: "Cozinha" }), quem({ funcoes: ["Auxiliar de cozinha"] })).nota, 100);
  igual(calcular(vaga({ profession: "Auxiliar de cozinha" }), quem({ funcoes: ["Cozinha"] })).nota, 100);
});

teste("função de duas letras não casa com tudo", () => {
  /* Sem o piso de tamanho, uma função como "TI" acharia "sTIlista",
     "consulTIvo" e meio dicionário — e a onda avisaria a cidade toda. */
  const { nota } = calcular(vaga({ profession: "Estilista" }), quem({ funcoes: ["TI"] }));
  verdade(nota !== null && nota < 80, `"TI" não devia casar com "Estilista" (veio ${nota})`);
});

grupo("a cidade");

teste("outra cidade tira pontos", () => {
  const mesma = calcular(vaga(), quem()).nota!;
  const outra = calcular(vaga(), quem({ cidade: "Ouro Preto" })).nota!;
  verdade(outra < mesma, `outra cidade devia valer menos (${outra} vs ${mesma})`);
});

grupo("o silêncio não pune ninguém");

teste("quem não disse o modo de trabalho não perde ponto por isso", () => {
  igual(calcular(vaga(), quem({ modo: null })).nota, 100);
});

teste("'tanto faz' serve para qualquer modo", () => {
  igual(calcular(vaga({ work_modality: "remoto" }), quem({ modo: "tanto_faz" })).nota, 100);
});

grupo("os critérios que só valem quando a empresa marca");

teste("CNH exigida derruba quem não tem", () => {
  const v = vaga({ cnh_exigida: true, campos_compatibilidade: ["profissao", "cnh"] });
  const semCnh = calcular(v, quem()).nota!;
  const comCnh = calcular(v, quem({ temCnh: true })).nota!;
  verdade(comCnh > semCnh, `com CNH devia valer mais (${comCnh} vs ${semCnh})`);
});

teste("categoria de CNH errada não conta como ter CNH", () => {
  const v = vaga({ cnh_exigida: true, cnh_categorias: ["D"], campos_compatibilidade: ["cnh"] });
  const so_b = calcular(v, quem({ temCnh: true, cnhCategorias: ["B"] })).nota!;
  const com_d = calcular(v, quem({ temCnh: true, cnhCategorias: ["D"] })).nota!;
  verdade(com_d > so_b, `categoria D devia valer mais que B (${com_d} vs ${so_b})`);
});

teste("escolaridade: a escada compara nível, não ordem alfabética", () => {
  verdade(
    ESCADA_ESCOLARIDADE.indexOf("superior") > ESCADA_ESCOLARIDADE.indexOf("medio"),
    "superior tem de ser maior que médio"
  );
  const v = vaga({ escolaridade_minima: "medio", campos_compatibilidade: ["escolaridade"] });
  igual(calcular(v, quem({ escolaridade: "superior" })).nota, 100, "quem tem mais que o pedido bate");
  /* Não é zero: o ofício conta sempre (ver `valendo`), então quem tem o
     ofício certo e a escolaridade abaixo continua sendo um candidato —
     só que abaixo de quem tem os dois. É o que a empresa quer ver. */
  const menos = calcular(v, quem({ escolaridade: "fundamental" })).nota!;
  verdade(menos < 100 && menos >= 60, `esperava entre 60 e 99, veio ${menos}`);
});

grupo("a pretensão de salário");

teste("quem pede menos que o teto da vaga cabe", () => {
  const v = vaga({
    salary_range_min: 180000,
    salary_range_max: 240000,
    campos_compatibilidade: ["pretensao"],
  });
  igual(calcular(v, quem({ pretensaoCentavos: 200000 })).nota, 100);
});

teste("quem pede mais que o teto não cabe", () => {
  const v = vaga({
    salary_range_min: 180000,
    salary_range_max: 240000,
    campos_compatibilidade: ["pretensao"],
  });
  /* De novo: o ofício conta sempre, então quem pede mais que o teto não
     zera — fica abaixo de quem cabe no orçamento. */
  const caro = calcular(v, quem({ pretensaoCentavos: 300000 })).nota!;
  const cabe = calcular(v, quem({ pretensaoCentavos: 200000 })).nota!;
  verdade(caro < cabe, `quem pede mais devia valer menos (${caro} vs ${cabe})`);
});

teste("'a combinar' de qualquer um dos lados não é desacordo", () => {
  const v = vaga({ salary_range_min: 100000, salary_range_max: 100000, campos_compatibilidade: ["pretensao"] });
  igual(calcular(v, quem({ pretensaoCentavos: 900000, pretensaoCombinar: true })).nota, 100);
  const vCombinar = vaga({ salario_a_combinar: true, campos_compatibilidade: ["pretensao"] });
  igual(calcular(vCombinar, quem({ pretensaoCentavos: 900000 })).nota, 100);
});

grupo("a nota nunca sai da régua");

teste("o resultado fica sempre entre 0 e 100", () => {
  const casos: JobListing[] = [
    vaga(),
    vaga({ campos_compatibilidade: ["profissao"] }),
    vaga({ campos_compatibilidade: ["profissao", "cidade", "cnh", "escolaridade", "pretensao"] }),
    vaga({ cnh_exigida: true, exige_viagem: true, available_immediately: true, jornada: "fins_de_semana" }),
  ];
  for (const v of casos) {
    for (const q of [quem(), quem({ funcoes: ["Outra coisa"], cidade: "X", modo: "remoto" })]) {
      const { nota } = calcular(v, q);
      entre(nota ?? 0, 0, 100, "nota fora da régua");
    }
  }
});

teste("campo desconhecido em campos_compatibilidade não gera NaN", () => {
  /* Um valor novo que nenhum critério reconheça deixaria a lista de
     critérios vazia, e a divisão viraria NaN — que na tela aparece como
     "NaN%" ou como nada. */
  const { nota } = calcular(vaga({ campos_compatibilidade: ["coisa_que_nao_existe"] }), quem());
  verdade(nota === null || Number.isFinite(nota), `nota inválida: ${nota}`);
});

grupo("o porquê que a tela mostra");

teste("o que casou aparece escrito, e o que não casou não aparece", () => {
  const { porque } = calcular(vaga(), quem());
  verdade(porque.includes("seu ofício"), "devia dizer que o ofício bateu");
  const outro = calcular(vaga(), quem({ funcoes: ["Manicure"] }));
  verdade(!outro.porque.includes("seu ofício"), "não devia dizer que o ofício bateu");
});

grupo("os buracos que a marcação de campos pode abrir");

teste("marcar só 'cnh' não pode fazer o ofício deixar de contar", () => {
  /* Se a empresa marca um campo só, a conta passa a considerar SÓ ele.
     Uma vaga de pedreiro marcando "cnh" daria 100% para uma manicure com
     CNH — e a onda 1 avisaria essa pessoa. */
  const v = vaga({ profession: "Pedreiro", cnh_exigida: true, campos_compatibilidade: ["cnh"] });
  const manicureComCnh = quem({ funcoes: ["Manicure"], temCnh: true, cnhCategorias: ["B"] });
  const { nota } = calcular(v, manicureComCnh);
  verdade(
    nota !== null && nota < 80,
    `manicure com CNH tirou ${nota}% numa vaga de pedreiro — a onda 1 avisaria ela`
  );
});

teste("a onda 3 não pode alcançar quem não tem nada a ver com a vaga", () => {
  /* A onda 3 é a faixa de 0 a 39, e o texto dela promete "quem faz coisa
     do mesmo ramo". Uma pessoa de outro ofício, de outra cidade, cai
     nessa faixa — e receberia a vaga. */
  const { nota } = calcular(
    vaga({ profession: "Pedreiro" }),
    quem({ funcoes: ["Manicure"], cidade: "Ouro Preto", modo: "remoto" })
  );
  verdade(nota === 0, `alguém sem nenhuma relação com a vaga tirou ${nota}% — a onda 3 avisaria`);
});

grupo("o que faltou — o que alimenta 'o que está custando vagas'");

teste("faltou traz o campo que a vaga pedia e o cadastro não atendeu", () => {
  const { faltou } = calcular(
    vaga({ cnh_exigida: true, cnh_categorias: ["D"] }),
    quem({ temCnh: false, cnhCategorias: [] })
  );
  verdade(faltou.includes("cnh"), `esperava 'cnh' em faltou, veio ${JSON.stringify(faltou)}`);
});

teste("o que a vaga NÃO pede nunca aparece em faltou", () => {
  /* É a mesma regra do `vale`: critério que a vaga não pede sai da conta
     inteira. Se ele aparecesse aqui, a tela de desempenho diria "8 vagas
     pedem CNH" contando vagas que não pedem CNH nenhuma — um número
     inventado numa tela cujo valor inteiro é ser honesta. */
  const { faltou } = calcular(
    vaga({ cnh_exigida: false, exige_viagem: false, escolaridade_minima: null }),
    quem({ temCnh: false, aceitaViajar: false, escolaridade: null })
  );
  verdade(!faltou.includes("cnh"), "CNH não era pedida e apareceu como falta");
  verdade(!faltou.includes("viagem"), "viagem não era pedida e apareceu como falta");
  verdade(!faltou.includes("escolaridade"), "escolaridade não era pedida e apareceu como falta");
});

teste("o que bateu nunca aparece nos dois ao mesmo tempo", () => {
  const r = calcular(
    vaga({ cnh_exigida: true, exige_viagem: true }),
    quem({ temCnh: true, cnhCategorias: ["B"], aceitaViajar: false })
  );
  verdade(r.porque.includes("sua CNH"), "a CNH bateu e não foi dita");
  verdade(r.faltou.includes("viagem"), "a viagem não bateu e não foi dita");
  verdade(!r.faltou.includes("cnh"), "a CNH bateu e mesmo assim entrou em faltou");
});

teste("cadastro sem nada devolve faltou vazio, e não uma lista de defeitos", () => {
  /* Quem ainda não se cadastrou não recebe diagnóstico: `nota` é null, e
     a tela de desempenho pula quem tem nota nula. Devolver uma lista de
     faltas aqui faria a tela dizer a alguém que acabou de chegar que ela
     falha em oito critérios. */
  igual(calcular(vaga(), null).faltou.length, 0);
  igual(calcular(vaga(), quem({ funcoes: [] })).faltou.length, 0);
});

teste("faltou e porque juntos cobrem exatamente os critérios em jogo", () => {
  /* A soma dos dois é a lista de critérios que valeram. Se um critério
     sumisse dos dois, a nota cairia sem nada explicando — e é justamente
     esse o defeito que a pessoa não teria como perceber. */
  const r = calcular(
    vaga({ cnh_exigida: true, exige_viagem: true, available_immediately: true }),
    quem({ temCnh: true, cnhCategorias: ["B"], aceitaViajar: false, inicioImediato: false })
  );
  /* ofício, cidade, modo, cnh, viagem, início = 6 critérios em jogo */
  igual(r.porque.length + r.faltou.length, 6);
});

process.exit(await resumo());
