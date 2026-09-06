import { normalizar } from "./normalizar";

/**
 * As palavras diferentes que querem dizer o mesmo ofício.
 *
 * ── O DEFEITO QUE ISTO CONSERTA ───────────────────────────────────────
 *
 * A conta de compatibilidade dá 60 pontos ao ofício — de longe o maior
 * peso, porque é ele que decide se a conversa começa. E até 06/09 esses
 * 60 pontos eram ganhos ou perdidos por uma comparação de TEXTO: a função
 * do cadastro precisava estar contida no que a vaga escreveu, ou o
 * contrário.
 *
 * Medido, com os dados reais do app:
 *
 *   vaga "Cozinheiro"       x  cadastro "Auxiliar de cozinha"  → não bate
 *   vaga "Serviços gerais"  x  cadastro "Marido de aluguel"    → não bate
 *   vaga "Vendedor"         x  cadastro "Atendente de loja"    → não bate
 *
 * Não bater não é só perder pontos: sem os 60 do ofício a nota fica na
 * faixa de baixo, a pessoa sai da onda 1 e a vaga nunca chega até ela. E
 * ninguém reclama de vaga que não chegou — é a classe de defeito mais
 * cara deste app, porque não deixa rastro.
 *
 * ── OS DOIS LADOS SÃO TEXTO LIVRE, E ISSO SURPREENDE ──────────────────
 *
 * O comentário de `MeuPerfilPage` diz que a empresa "escolhe de uma lista
 * fechada". Não escolhe mais: o campo da vaga é um `input` com `list`, ou
 * seja, a lista SUGERE e a empresa digita o que quiser (ver
 * `CriarVagaPage`, e o comentário de lá explicando por quê — "auxiliar de
 * produção" e "operador de empilhadeira" não existem na lista).
 *
 * Então não são "uma lista fechada contra texto livre": são DOIS textos
 * livres. Duas pessoas escrevendo a mesma profissão de dois jeitos é o
 * caso comum, não a exceção.
 *
 * ── POR QUE DICIONÁRIO, E NÃO UM AGENTE DE IA ─────────────────────────
 *
 * A dona perguntou por IA para esta conta. O motivo de não ser ela, aqui:
 *
 *   . o número precisa ser EXPLICÁVEL. A tela diz "85% porque bate seu
 *     ofício e sua cidade", e a mesma conta aparece em três lugares. Uma
 *     nota que muda de valor entre duas consultas iguais destrói a
 *     confiança nos três de uma vez;
 *   . o vocabulário de uma cidade de cinquenta mil habitantes é pequeno e
 *     acaba. O que está aqui embaixo cobre o que Itabirito tem;
 *   . custa zero, responde na hora e funciona sem internet.
 *
 * Onde a IA valeria a pena é outra coisa — LER a vaga mal escrita e
 * sugerir o ofício na hora de publicar, uma chamada só, com a empresa
 * conferindo antes de salvar. Errar ali não tem consequência.
 *
 * ── COMO ACRESCENTAR ──────────────────────────────────────────────────
 *
 * Achou um par que devia bater e não bate? Ponha as duas palavras na
 * MESMA linha aqui embaixo. Nada mais precisa mudar.
 *
 * E o cuidado que vale mais que a cobertura: **linha larga demais é pior
 * que linha faltando.** Juntar "motorista" e "motoboy" numa família só
 * faria toda vaga de entrega de moto chegar para quem dirige caminhão —
 * e a onda 1, que é a que a empresa dispara primeiro, é justamente a que
 * não pode errar. Na dúvida, deixe em famílias separadas: quem não
 * recebeu a onda 1 ainda recebe a 2 e a 3.
 */
const FAMILIAS: readonly (readonly string[])[] = [
  // ── Casa e obra ────────────────────────────────────────────────────
  ["pedreiro", "pedreira", "alvenaria", "assentador", "azulejista", "ladrilheiro"],
  ["servente", "servente de obra", "ajudante de obra", "ajudante de pedreiro", "meio oficial"],
  ["pintor", "pintora", "pintor de parede", "pintura predial", "pintura residencial"],
  ["eletricista", "eletricista predial", "eletricista residencial", "instalador eletrico"],
  ["encanador", "bombeiro hidraulico", "hidraulico", "instalador hidraulico"],
  ["marceneiro", "marcenaria", "carpinteiro", "carpintaria"],
  ["serralheiro", "serralheria", "soldador", "solda", "caldeireiro"],
  ["vidraceiro", "vidracaria"],
  ["gesseiro", "gesso", "drywall"],
  ["marido de aluguel", "servicos gerais", "servico geral", "faz tudo", "manutencao predial",
   "pequenos reparos", "reparos em geral"],
  ["montador de moveis", "montador", "montagem de moveis"],
  ["chaveiro", "chaveiria"],
  ["jardineiro", "jardinagem", "paisagismo", "roçador", "rocador", "capina"],
  ["piscineiro", "limpeza de piscina"],
  ["dedetizador", "dedetizacao", "controle de pragas"],
  ["diarista", "faxineira", "faxineiro", "faxina", "servicos domesticos", "empregada domestica",
   "auxiliar de limpeza", "limpeza", "zeladora", "zelador"],
  ["passadeira", "passadeiro", "passar roupa", "lavanderia"],
  ["cuidador de idosos", "cuidadora de idosos", "cuidador", "cuidadora", "acompanhante de idosos"],
  ["baba", "babá", "cuidadora de criancas", "auxiliar de creche"],

  // ── Técnica e conserto ─────────────────────────────────────────────
  ["tecnico em informatica", "informatica", "suporte tecnico", "manutencao de computadores"],
  ["tecnico em celulares", "conserto de celular", "assistencia tecnica de celular"],
  ["refrigeracao e ar-condicionado", "refrigeracao", "ar-condicionado", "ar condicionado",
   "climatizacao", "tecnico em refrigeracao"],
  ["conserto de eletrodomesticos", "eletrodomesticos", "tecnico em eletrodomesticos"],
  ["mecanico", "mecanica", "mecanico de automoveis", "mecanico de carros", "auto mecanica"],
  ["borracheiro", "borracharia"],
  ["lavagem de carros", "lava jato", "lava-jato", "lavador de carros", "esteticista automotiva"],
  ["funilaria e pintura automotiva", "funileiro", "funilaria", "pintura automotiva"],

  // ── Beleza e bem-estar ─────────────────────────────────────────────
  ["cabeleireiro", "cabeleireira", "hair stylist", "salao de beleza"],
  ["barbeiro", "barbearia", "barber"],
  ["manicure", "pedicure", "manicure e pedicure", "unhas", "nail designer"],
  ["depilacao", "depiladora", "depilador"],
  ["maquiadora", "maquiador", "maquiagem", "make"],
  ["estetica e sobrancelhas", "estetica", "esteticista", "sobrancelhas", "designer de sobrancelhas",
   "micropigmentacao", "cilios", "lash designer"],
  ["massagista", "massagem", "massoterapeuta"],
  ["personal trainer", "personal", "educador fisico", "professor de educacao fisica"],
  ["nutricionista", "nutricao"],
  ["fisioterapeuta", "fisioterapia"],
  ["psicologo", "psicologa", "psicologia"],

  // ── Ensino ─────────────────────────────────────────────────────────
  ["professor particular", "professora particular", "aulas particulares", "reforco escolar",
   "reforço escolar", "professor de reforco"],
  ["professor de ingles", "professora de ingles", "aulas de ingles", "ingles"],
  ["professor de musica", "professora de musica", "aulas de musica", "musica",
   "professor de violao", "professor de piano"],
  ["palestrante", "palestras"],

  // ── Festas, comida e imagem ────────────────────────────────────────
  ["fotografo", "fotografa", "fotografia"],
  ["filmagem", "videomaker", "cinegrafista", "edicao de video"],
  ["confeiteira", "confeiteiro", "confeitaria", "bolos", "doces", "docinhos"],
  ["salgadeira", "salgadeiro", "salgados"],
  ["cozinheira", "cozinheiro", "cozinha", "auxiliar de cozinha", "ajudante de cozinha",
   "chefe de cozinha", "chef de cozinha", "chef", "cozinha industrial"],
  ["chapeiro", "chapeira", "lanches", "pastel", "pizzaiolo", "pizzaiolo(a)", "pizzaiola"],
  ["buffet e festas", "buffet", "bufe", "festas", "eventos", "organizacao de eventos"],
  ["dj e som", "dj", "sonorizacao", "som e iluminacao"],
  ["decoracao de festas", "decoracao", "decorador", "decoradora"],
  ["garcom", "garçom", "garconete", "garçonete", "atendente de restaurante", "atendente de bar",
   "salao", "barista"],
  ["padeiro", "padeira", "panificacao", "forneiro"],
  ["acougueiro", "açougueiro", "acougue"],

  // ── Costura e artesanato ───────────────────────────────────────────
  ["costureira", "costureiro", "costura", "costura de uniformes", "modelista", "cortador"],
  ["sapateiro", "sapataria", "conserto de calcados"],
  ["tapeceiro", "tapecaria", "estofador", "estofaria"],
  ["artesanato", "artesa", "artesao", "artesã", "artesão"],

  // ── Transporte e logística ─────────────────────────────────────────
  // Motorista e motoboy ficam SEPARADOS de propósito: carteira, veículo e
  // rotina são outros, e juntá-los mandaria toda entrega de moto para quem
  // dirige caminhão.
  ["motorista", "motorista de caminhao", "caminhoneiro", "motorista de van",
   "motorista de onibus", "carreteiro", "motorista de aplicativo"],
  ["motoboy", "motoentregador", "entregador de moto", "entregas de moto"],
  ["entregador", "entregas", "delivery"],
  ["frete e mudancas", "frete", "mudancas", "carreto", "fretes"],
  ["estoquista", "estoque", "auxiliar de estoque", "conferente", "almoxarife", "almoxarifado",
   "repositor", "repositora"],
  ["operador de empilhadeira", "empilhadeira", "operador de maquinas", "operador de maquina"],

  // ── Comércio e atendimento ─────────────────────────────────────────
  ["vendedor", "vendedora", "vendas", "consultor de vendas", "consultora de vendas",
   "atendente de loja", "balconista", "promotor de vendas", "promotora de vendas"],
  ["caixa", "operador de caixa", "operadora de caixa", "frente de caixa"],
  ["atendente", "atendimento", "atendente de balcao", "auxiliar de atendimento"],
  ["recepcionista", "recepcao", "recepção"],
  ["auxiliar administrativo", "administrativo", "assistente administrativo", "escritorio",
   "auxiliar de escritorio", "secretaria", "secretário", "secretario"],
  ["telemarketing", "call center", "operador de telemarketing", "sac"],

  // ── Segurança, saúde e serviços ────────────────────────────────────
  ["seguranca e portaria", "seguranca", "segurança", "porteiro", "porteira", "portaria",
   "vigia", "vigilante", "controlador de acesso"],
  ["enfermagem em casa", "enfermagem", "tecnico de enfermagem", "tecnica de enfermagem",
   "auxiliar de enfermagem", "enfermeiro", "enfermeira"],
  ["veterinario", "veterinaria", "medico veterinario"],
  ["banho e tosa", "tosador", "tosadora", "tosa", "pet shop", "petshop"],
  ["contador", "contadora", "contabilidade", "auxiliar contabil", "tecnico em contabilidade"],
  ["advogado", "advogada", "advocacia", "estagiario de direito"],
  ["corretor de imoveis", "corretora de imoveis", "corretor", "imobiliaria"],
  ["designer grafico", "design grafico", "designer", "artes graficas"],
  ["social media", "midias sociais", "marketing digital", "marketing"],

  // ── Indústria e mineração — Itabirito é cidade de minério ──────────
  ["auxiliar de producao", "auxiliar de produção", "operador de producao", "producao",
   "ajudante de producao", "auxiliar industrial"],
  ["mecanico industrial", "manutencao industrial", "mecanico de manutencao"],
  ["eletricista industrial", "eletrotecnico", "eletrotécnico"],
];

/**
 * A palavra que representa cada família. É sempre a primeira da linha —
 * arbitrário e proposital: só precisa ser a MESMA para todos os termos da
 * família, e ninguém lê este valor na tela.
 */
const RAIZ_DE = (() => {
  const mapa = new Map<string, string>();
  for (const familia of FAMILIAS) {
    const raiz = normalizar(familia[0]);
    for (const termo of familia) mapa.set(normalizar(termo), raiz);
  }
  return mapa;
})();

/**
 * Os termos, do maior para o menor.
 *
 * A ordem importa e o motivo é concreto: "auxiliar de cozinha" contém
 * "cozinha", e as duas estão no dicionário. Varrendo do maior para o
 * menor, a expressão inteira é encontrada antes do pedaço dela — e como
 * as duas caem na mesma família aqui não muda o resultado, mas mudaria no
 * dia em que alguém separasse "auxiliar de cozinha" numa família própria.
 */
const TERMOS = [...RAIZ_DE.keys()].sort((a, b) => b.length - a.length);

/**
 * Escapa o que for especial numa expressão regular. "pizzaiolo(a)" tem
 * parênteses, e sem isto eles viram grupo de captura — a busca passaria a
 * procurar "pizzaiolo" seguido de um "a" opcional, que por acaso até
 * funciona, e no próximo termo com ponto ou traço não funcionaria mais.
 */
function escapar(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * As famílias de ofício que aparecem neste texto.
 *
 * Serve tanto para uma função do cadastro ("Auxiliar de cozinha") quanto
 * para a frase inteira da vaga ("Cozinheiro para restaurante no Centro"),
 * porque procura cada termo como PALAVRA e não como pedaço de palavra.
 *
 * A borda é `[^a-z0-9]` e não o `\b` do JavaScript: depois do `normalizar`
 * o texto não tem acento, mas tem hífen e barra ("lava-jato",
 * "salgados/doces"), e ali o `\b` se comporta de um jeito que não é o que
 * se quer.
 */
export function familiasDoTexto(texto: string): Set<string> {
  const t = ` ${normalizar(texto)} `;
  const achadas = new Set<string>();
  for (const termo of TERMOS) {
    const re = new RegExp(`(^|[^a-z0-9])${escapar(termo)}([^a-z0-9]|$)`);
    if (re.test(t)) achadas.add(RAIZ_DE.get(termo)!);
  }
  return achadas;
}

/**
 * Estes dois textos falam do mesmo ofício?
 *
 * Só responde `true` quando o dicionário reconhece os DOIS lados e eles
 * caem na mesma família. Texto que o dicionário não conhece devolve
 * `false` — e aí quem decide continua sendo a comparação de sempre, que
 * é conservadora e já existe. Este arquivo só ACRESCENTA acertos; ele
 * nunca tira um que já acontecia.
 */
export function mesmoOficio(a: string, b: string): boolean {
  const daA = familiasDoTexto(a);
  if (daA.size === 0) return false;
  for (const f of familiasDoTexto(b)) {
    if (daA.has(f)) return true;
  }
  return false;
}
