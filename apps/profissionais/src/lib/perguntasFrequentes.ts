import { normalizar } from "./normalizar";

/**
 * As perguntas de suporte, e a busca que acha a resposta certa.
 *
 * ── De onde veio — 06/09 ──────────────────────────────────────────────
 *
 * A dona: "quero criar no app um FAQ com as principais dúvidas de suporte
 * onde tenha todas as funcionalidades explicadas. Talvez até que utilize
 * inteligência artificial para entender a pergunta da pessoa."
 *
 * ── Por que a busca, e não um modelo de IA ────────────────────────────
 *
 * O que ela pediu é que a pessoa possa PERGUNTAR do jeito dela, em vez de
 * caçar numa lista de trinta títulos. Isso é o problema de entender a
 * pergunta — e ele se resolve aqui com sinônimos e busca por palavra, sem
 * servidor, sem chave de API, sem conta a pagar e sem esperar resposta.
 *
 * Um modelo de linguagem responderia melhor as perguntas que ninguém
 * previu, e é a razão de valer a pena um dia. Mas ele também INVENTA: num
 * app onde a resposta errada é "o plano dá direito a X vagas" ou "dá para
 * cancelar em Y dias", uma frase bem escrita e falsa custa mais caro do
 * que um "não achei". E toda pergunta passaria a custar dinheiro e a
 * depender de a internet do celular estar boa naquele instante.
 *
 * Então: a busca resolve hoje o que ela pediu, e o caminho para a IA
 * continua aberto — o texto das respostas daqui é justamente o material
 * que um modelo precisaria para responder sem inventar.
 *
 * ── A regra das respostas ─────────────────────────────────────────────
 *
 * Cada resposta tem de bastar por si. Quem chega numa pergunta pela busca
 * não leu as de cima, então "como já foi dito acima" não existe aqui. E
 * nenhuma resposta cita preço: dentro do app da Play Store, valor de
 * assinatura é assunto proibido (ver `podeVender()`), e um FAQ é o último
 * lugar onde alguém lembraria de conferir isso.
 */

export type LadoDaPergunta = "profissional" | "empresa" | "todos";

export type Pergunta = {
  id: string;
  lado: LadoDaPergunta;
  grupo: string;
  pergunta: string;
  /** Um parágrafo por item. */
  resposta: string[];
  /**
   * Palavras que a pessoa digitaria e que NÃO aparecem na pergunta nem na
   * resposta. É o que faz "sumi da busca" achar o modo oculto, e "zap"
   * achar o WhatsApp — o mais perto de "entender a pergunta" que dá para
   * fazer sem um modelo de linguagem.
   */
  tambem?: string[];
  link?: { para: string; texto: string };
};

export const PERGUNTAS: Pergunta[] = [
  // ── Começando ────────────────────────────────────────────────────────
  {
    id: "o-que-e",
    lado: "todos",
    grupo: "Começando",
    pergunta: "O que é o Ei Emprego?",
    resposta: [
      "É um app de Itabirito e região que aproxima quem procura emprego de quem está contratando.",
      "Quem procura trabalho monta um cadastro de graça e passa a aparecer para as empresas da cidade. Quem contrata encontra essas pessoas e publica vagas, que chegam como aviso para quem faz aquele serviço.",
      "O Ei não contrata ninguém: ele apresenta os dois lados e sai do caminho. A conversa e o combinado são entre vocês.",
    ],
    tambem: ["para que serve", "como funciona o app", "aplicativo"],
    link: { para: "/como-funciona", texto: "Ver como funciona" },
  },
  {
    id: "custa",
    lado: "todos",
    grupo: "Começando",
    pergunta: "O app é gratuito?",
    resposta: [
      "Para quem procura emprego, sim: o cadastro é de graça, aparecer na busca é de graça e responder às vagas é de graça. Nunca cobramos nada de quem procura trabalho.",
      "Para quem contrata, ver os profissionais e falar com eles também não custa. O plano só é necessário para publicar vaga e disparar os avisos.",
      "Se alguém te pedir dinheiro para conseguir uma vaga aqui, é golpe. Denuncie pelo app.",
    ],
    tambem: ["gratis", "de graca", "pagar", "quanto custa", "cobra"],
  },
  {
    id: "entrar",
    lado: "todos",
    grupo: "Começando",
    pergunta: "Não consigo entrar. E agora?",
    resposta: [
      "Dá para entrar de dois jeitos: pelo telefone, com um código que chega por SMS, ou pela conta Google.",
      "Se o código não chegar, confira o número (com DDD) e espere um minuto antes de pedir outro. Importante: pedir um código novo cancela o anterior — se você pedir duas vezes, só o último funciona.",
      "Se o app disser 'código incorreto' mas você tiver certeza de que digitou certo, feche e abra de novo: às vezes a entrada já aconteceu.",
    ],
    tambem: ["login", "senha", "codigo", "sms", "nao recebi", "acesso"],
  },

  // ── Meu cadastro ─────────────────────────────────────────────────────
  {
    id: "criar-cadastro",
    lado: "profissional",
    grupo: "Meu cadastro",
    pergunta: "Como faço o meu cadastro?",
    resposta: [
      "Entre no app, escolha 'Procuro emprego' e preencha o cadastro: nome, telefone, cidade, as funções que você aceita fazer e, se quiser, foto, experiências e cursos.",
      "Duas coisas são obrigatórias: confirmar o telefone pelo código e marcar a autorização de divulgação, na caixinha logo acima do botão Salvar.",
      "Quanto mais completo, mais chance: uma empresa que vê foto, experiência e telefone chama mais rápido do que uma que vê só um nome.",
    ],
    tambem: ["me cadastrar", "curriculo", "perfil", "comecar"],
    link: { para: "/meu-perfil", texto: "Abrir meu cadastro" },
  },
  {
    id: "confirmar-telefone",
    lado: "profissional",
    grupo: "Meu cadastro",
    pergunta: "Por que preciso confirmar o telefone?",
    resposta: [
      "Porque é o telefone que a empresa usa para te chamar, e porque a confirmação impede que alguém crie cadastro no seu nome.",
      "Sem a confirmação, o cadastro fica salvo mas não aparece para ninguém e não recebe aviso de vaga.",
      "É rápido: toque em 'Confirmar este número' no campo do telefone, e digite o código que chega por SMS.",
    ],
    tambem: ["verificar numero", "codigo do telefone", "nao aparece na busca"],
  },
  {
    id: "quantas-funcoes",
    lado: "profissional",
    grupo: "Meu cadastro",
    pergunta: "Quantas funções posso marcar?",
    resposta: [
      "Até oito. Marque as que você realmente aceita fazer: é por elas que as vagas chegam até você e que as empresas te encontram na busca.",
      "Marcar função que você não faz atrapalha os dois lados — você recebe aviso do que não quer, e a empresa te chama para o que você não vai aceitar.",
    ],
    tambem: ["profissao", "oficio", "o que aceito fazer", "areas"],
  },
  {
    id: "modo-oculto",
    lado: "profissional",
    grupo: "Meu cadastro",
    pergunta: "Posso procurar emprego sem que me vejam?",
    resposta: [
      "Pode. Ligue o modo oculto dentro do seu cadastro.",
      "No modo oculto o seu perfil sai da busca e das listas: nem as empresas nem qualquer pessoa na internet conseguem te ver.",
      "Mesmo oculto você continua recebendo os avisos das vagas do seu ofício. A empresa só passa a ver os seus dados se VOCÊ responder que tem interesse.",
      "É o modo de quem já trabalha e não quer que o patrão descubra que está olhando.",
    ],
    tambem: ["sumir da busca", "privado", "escondido", "ninguem me ver", "patrao"],
  },
  {
    id: "inativar",
    lado: "profissional",
    grupo: "Meu cadastro",
    pergunta: "Consegui emprego. O que faço com o cadastro?",
    resposta: [
      "Parabéns! Inative o cadastro, no fim da tela 'Meu cadastro'.",
      "Inativo, você some da busca e para de receber aviso de vaga — e nada do que você preencheu se perde. Quando precisar de novo, é um toque para reativar.",
      "Se preferir apagar tudo de vez, use Excluir minha conta. Aí sim é definitivo.",
    ],
    tambem: ["arrumei emprego", "parar de receber", "desativar", "pausar"],
  },
  {
    id: "excluir",
    lado: "todos",
    grupo: "Meu cadastro",
    pergunta: "Como apago a minha conta?",
    resposta: [
      "Em Perfil, toque em 'Excluir minha conta'. É imediato e definitivo: apagamos o seu cadastro, funções, experiências, avisos e os aparelhos cadastrados para notificação.",
      "Duas coisas continuam: os registros de acesso, que a lei manda guardar por seis meses, e o interesse que você enviou a uma vaga — ele fica com a empresa que recebeu, porque é o recado que permitia ela te retornar.",
      "Se você só quer sumir da busca sem perder o cadastro, use o modo oculto ou inative — dá para voltar depois.",
    ],
    tambem: ["deletar", "cancelar cadastro", "sair de vez", "lgpd"],
    link: { para: "/excluir-conta", texto: "Excluir minha conta" },
  },

  // ── Vagas ────────────────────────────────────────────────────────────
  {
    id: "receber-vagas",
    lado: "profissional",
    grupo: "Vagas",
    pergunta: "Como as vagas chegam até mim?",
    resposta: [
      "Quando uma empresa publica uma vaga, o app procura quem faz aquele serviço na cidade e manda o aviso — no app e, se você permitir, como notificação no celular.",
      "Para receber, três coisas precisam estar certas: telefone confirmado, cadastro ativo e ao menos uma função marcada.",
      "Você também pode procurar sozinho, no Banco de vagas, sem esperar aviso nenhum.",
    ],
    tambem: ["aviso de vaga", "notificacao", "nao recebo vaga", "push"],
    link: { para: "/vagas", texto: "Ver as vagas abertas" },
  },
  {
    id: "responder-vaga",
    lado: "profissional",
    grupo: "Vagas",
    pergunta: "Como respondo a uma vaga?",
    resposta: [
      "Abra a vaga e toque em 'Tenho interesse'. Pronto: a empresa recebe o seu cadastro na lista de interessados e fala com você pelo telefone que está lá.",
      "Você pode responder até cinco vagas por dia. O limite existe para o app não virar uma enxurrada de currículos iguais — quem responde tudo acaba não sendo chamado para nada.",
      "Responder não obriga a nada. Se mudar de ideia, é só dizer para a empresa quando ela ligar.",
    ],
    tambem: ["candidatar", "me inscrever", "tenho interesse", "limite"],
  },
  {
    id: "compatibilidade",
    lado: "profissional",
    grupo: "Vagas",
    pergunta: "O que é aquele número de compatibilidade na vaga?",
    resposta: [
      "É o quanto aquela vaga combina com o seu cadastro: a função, a cidade, o horário, o salário que você espera e o que mais a empresa pediu.",
      "É só uma dica, não uma nota. Uma vaga de 60% pode ser exatamente a sua — e nada impede você de responder a qualquer uma.",
      "A melhor forma de melhorar esse número é completar o cadastro: campo em branco não combina com nada.",
    ],
    tambem: ["porcentagem", "combina", "match", "%"],
  },
  {
    id: "empresa-nao-respondeu",
    lado: "profissional",
    grupo: "Vagas",
    pergunta: "Respondi a uma vaga e ninguém me chamou.",
    resposta: [
      "Infelizmente isso acontece: o Ei entrega o seu cadastro para a empresa, mas quem decide chamar é ela.",
      "O que costuma ajudar: colocar foto, escrever as experiências e deixar o telefone certo e confirmado. Cadastro completo é chamado bem mais.",
      "Em 'Meu desempenho' você vê quantas empresas abriram o seu perfil — se muita gente abre e ninguém chama, em geral é o cadastro que está faltando informação.",
    ],
    tambem: ["nao me chamaram", "sem resposta", "ninguem ligou"],
    link: { para: "/meu-desempenho", texto: "Ver meu desempenho" },
  },

  // ── Contratando ──────────────────────────────────────────────────────
  {
    id: "achar-gente",
    lado: "empresa",
    grupo: "Contratando",
    pergunta: "Como encontro alguém para contratar?",
    resposta: [
      "Entre como 'Quero contratar' e abra o Banco de talentos: estão lá todas as pessoas cadastradas na cidade, com função, experiência e telefone.",
      "Dá para filtrar por cidade e por função, e procurar por palavra. Achou alguém, o telefone está na ficha — é só ligar ou chamar no WhatsApp.",
      "Isso não custa nada e não precisa de plano.",
    ],
    tambem: ["banco de talentos", "procurar profissional", "achar candidato"],
    link: { para: "/profissionais", texto: "Abrir o banco de talentos" },
  },
  {
    id: "publicar-vaga",
    lado: "empresa",
    grupo: "Contratando",
    pergunta: "Como publico uma vaga?",
    resposta: [
      "Primeiro cadastre a sua empresa (nome, CNPJ ou CPF, telefone e cidade). Depois, em 'Nova vaga', escreva o que você precisa: função, horário, salário e o que mais for importante.",
      "Ao publicar, o app avisa quem faz aquele serviço na cidade. Quem tiver interesse aparece na sua lista de interessados, com o telefone.",
      "Publicar vaga é o que exige plano ativo. Ver e falar com as pessoas do banco de talentos continua livre.",
    ],
    tambem: ["criar vaga", "anunciar", "abrir vaga", "divulgar"],
    link: { para: "/criar-vaga", texto: "Criar uma vaga" },
  },
  {
    id: "ondas",
    lado: "empresa",
    grupo: "Contratando",
    pergunta: "O que são as ondas de aviso?",
    resposta: [
      "Em vez de mandar a vaga para todo mundo de uma vez, o app avisa primeiro quem mais combina com ela. Se ninguém responder, ele amplia para o grupo seguinte.",
      "Isso evita duas coisas ruins: você receber cinquenta interessados que não têm nada a ver com a vaga, e as pessoas receberem aviso do que não fazem.",
      "Você acompanha cada onda na tela da vaga e pode ampliar na hora que quiser, sem esperar.",
    ],
    tambem: ["disparo", "quem recebeu", "alcance"],
  },
  {
    id: "interessados",
    lado: "empresa",
    grupo: "Contratando",
    pergunta: "Onde vejo quem se interessou pela minha vaga?",
    resposta: [
      "Na tela da vaga, em 'Interessados'. Cada pessoa aparece com foto, funções, experiência e telefone.",
      "Dá para marcar quem você já chamou e quem não serve, para não ligar duas vezes para a mesma pessoa nem perder alguém no meio da lista.",
      "O telefone está ali para ser usado: o app não intermedeia a conversa.",
    ],
    tambem: ["candidatos", "quem respondeu", "lista de pessoas"],
  },
  {
    id: "encerrar-vaga",
    lado: "empresa",
    grupo: "Contratando",
    pergunta: "Já contratei. Como tiro a vaga do ar?",
    resposta: [
      "Abra a vaga e toque em 'Encerrar'. O app pergunta como foi — se você contratou por aqui, quantas pessoas e por qual vaga.",
      "Responder leva dez segundos e é o que alimenta o número de pessoas empregadas pelo Ei. Ninguém vê a sua resposta individualmente.",
      "Vaga encerrada some da busca e para de receber interessado.",
    ],
    tambem: ["fechar vaga", "tirar do ar", "contratei"],
  },

  // ── Planos e pagamento ───────────────────────────────────────────────
  {
    id: "o-que-o-plano-da",
    lado: "empresa",
    grupo: "Planos e pagamento",
    pergunta: "O que o plano me dá?",
    resposta: [
      "O plano é o que permite publicar vaga e disparar os avisos para quem faz aquele serviço na cidade. Cada plano tem um número de vagas e um prazo.",
      "Sem plano você continua vendo todos os profissionais e falando com eles — isso nunca foi cobrado.",
      "O que se contrata é a divulgação, não o resultado: o aviso alcança quem está cadastrado naquele ofício, e não há como garantir quantas pessoas vão responder.",
    ],
    tambem: ["assinatura", "vantagens", "beneficios"],
  },
  {
    id: "cancelar-plano",
    lado: "empresa",
    grupo: "Planos e pagamento",
    pergunta: "Como cancelo o meu plano?",
    resposta: [
      "Em 'Suas assinaturas', dentro do app, no mesmo lugar em que ele foi contratado. Não precisa falar com ninguém nem pedir por telefone.",
      "Cancelando em até 7 dias da contratação, o valor volta integralmente, sem precisar justificar — é o direito de arrependimento do Código de Defesa do Consumidor.",
      "Depois dos 7 dias, o cancelamento interrompe as cobranças seguintes e o período já pago continua valendo até o fim. Não há multa.",
    ],
    tambem: ["cancelamento", "estorno", "arrependimento", "devolucao", "reembolso"],
    link: { para: "/reembolso", texto: "Ver as regras de reembolso" },
  },
  {
    id: "pagamento",
    lado: "empresa",
    grupo: "Planos e pagamento",
    pergunta: "Como funciona o pagamento?",
    resposta: [
      "Os pagamentos são processados pelo Mercado Pago. Os dados do seu cartão não passam pelo Ei Emprego.",
      "O prazo de estorno na fatura ou na conta depende do seu banco ou da administradora do cartão, e não do app.",
    ],
    tambem: ["mercado pago", "cartao", "pix", "boleto", "nota fiscal"],
  },

  // ── Segurança e dados ────────────────────────────────────────────────
  {
    id: "quem-ve-meus-dados",
    lado: "profissional",
    grupo: "Segurança e dados",
    pergunta: "Quem vê os meus dados?",
    resposta: [
      "Seu nome, foto, cidade, funções, experiências e o telefone que você preencher ficam visíveis para as empresas e para qualquer pessoa na internet. É assim que alguém te encontra e te chama — é para isso que a plataforma existe, e é o que você autoriza ao marcar a caixinha antes de salvar.",
      "Nunca ficam visíveis: o seu CPF, o seu CNPJ e o e-mail que você usa para entrar.",
      "Se você não quiser aparecer, ligue o modo oculto: aí ninguém te vê e você continua recebendo os avisos de vaga.",
    ],
    tambem: ["privacidade", "meus dados", "aparece para quem", "publico", "lgpd"],
    link: { para: "/privacidade", texto: "Ler a Política de Privacidade" },
  },
  {
    id: "golpe",
    lado: "todos",
    grupo: "Segurança e dados",
    pergunta: "Como sei se uma vaga é golpe?",
    resposta: [
      "Desconfie de qualquer vaga que peça dinheiro adiantado, depósito, taxa de cadastro, compra de material, dados bancários ou envio de documentos por fora do app.",
      "Vaga de verdade não cobra nada de quem procura emprego. Nunca.",
      "Encontrou algo assim? Denuncie pelo app, no botão de denúncia da vaga ou do perfil. Olhamos todas as denúncias e podemos remover o cadastro.",
    ],
    tambem: ["fraude", "falsa", "denunciar", "suspeita", "pediu dinheiro"],
  },
  {
    id: "responsabilidade",
    lado: "todos",
    grupo: "Segurança e dados",
    pergunta: "O Ei Emprego garante a contratação?",
    resposta: [
      "Não. O Ei é uma plataforma de intermediação e consulta: ele aproxima os dois lados e entrega os contatos.",
      "Tudo o que for combinado entre um profissional e uma empresa — contratação, pagamento, horário, condições — é exclusivamente entre eles. A plataforma não é parte no combinado e não responde por ele.",
      "Também não conferimos documentos, não checamos antecedentes nem validamos diplomas. Confira as informações e peça referências antes de fechar qualquer acordo.",
    ],
    tambem: ["garantia", "responsabilidade", "calote", "nao pagou", "termos"],
    link: { para: "/termos", texto: "Ler os Termos de Uso" },
  },
  {
    id: "suporte",
    lado: "todos",
    grupo: "Segurança e dados",
    pergunta: "Não achei a minha dúvida. Como falo com alguém?",
    resposta: [
      "Chame no WhatsApp do suporte — o botão está aqui embaixo e no rodapé do app.",
      "Escreva o que aconteceu e, se der, mande um print da tela: com a imagem a resposta costuma vir na primeira mensagem.",
    ],
    tambem: ["ajuda", "atendimento", "falar com alguem", "contato", "zap"],
  },
];

/* Palavras que aparecem em quase toda frase e não ajudam a escolher
   resposta nenhuma. Sem tirá-las, procurar "como faço para me cadastrar"
   casaria com tudo que tem "como" ou "para" — ou seja, com tudo. */
const VAZIAS = new Set([
  "a", "as", "o", "os", "um", "uma", "de", "do", "da", "dos", "das", "e", "em",
  "no", "na", "nos", "nas", "por", "para", "pra", "com", "que", "qual", "quais",
  "como", "onde", "quando", "se", "eu", "meu", "minha", "meus", "minhas", "ao",
  "the", "ei", "app", "aplicativo", "fazer", "faco", "posso", "quero", "tem",
]);

/**
 * Procura a pergunta que responde o que foi digitado.
 *
 * Não é busca por trecho: quem digita "não recebo vaga nenhuma" não tem
 * nenhuma frase igual a essa em lugar nenhum. Cada palavra vale pontos, e
 * onde ela aparece muda quanto vale — palavra no título da pergunta ou na
 * lista de sinônimos aponta muito mais que a mesma palavra perdida no meio
 * de uma resposta longa.
 *
 * Prefixo conta como acerto ("cadastr" acha "cadastrar" e "cadastro"), o
 * que resolve plural e conjugação sem precisar de dicionário.
 */
export function procurarPerguntas(texto: string, lista = PERGUNTAS): Pergunta[] {
  const palavras = normalizar(texto)
    .split(/[^a-z0-9%]+/)
    .filter((p) => p.length > 1 && !VAZIAS.has(p));

  if (palavras.length === 0) return [];

  /* ── O CASAMENTO POR PREFIXO, E O TAMANHO MÍNIMO — 06/09 ───────────
     Aqui estava `w.startsWith(p) || p.startsWith(w)`, sem tamanho
     mínimo. O efeito foi medido no navegador: procurar "estorno"
     devolvia as 25 perguntas. Motivo — "estorno" começa com "e", e "e"
     é uma palavra que existe em quase toda resposta.

     Agora o prefixo só vale quando a palavra mais CURTA das duas tem
     pelo menos quatro letras. "cadastr" continua achando "cadastro" e
     "cadastrar" (é o que resolve plural e conjugação sem dicionário), e
     "e", "de" e "por" deixam de casar com o mundo. */
  const casa = (alvo: string, p: string) =>
    alvo.split(/[^a-z0-9%]+/).some((w) => {
      if (w.length < 2) return false;
      if (w === p) return true;
      const [menor, maior] = w.length < p.length ? [w, p] : [p, w];
      return menor.length >= 4 && maior.startsWith(menor);
    });

  const pontuadas = lista.map((q) => {
    const titulo = normalizar(q.pergunta);
    const sinonimos = normalizar((q.tambem ?? []).join(" "));
    const corpo = normalizar(q.resposta.join(" "));
    const grupo = normalizar(q.grupo);

    let pontos = 0;
    for (const p of palavras) {
      if (casa(titulo, p)) pontos += 6;
      else if (casa(sinonimos, p)) pontos += 5;
      else if (casa(grupo, p)) pontos += 2;
      else if (casa(corpo, p)) pontos += 1;
    }
    return { q, pontos };
  });

  return pontuadas
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.q);
}

/** As perguntas que interessam a um lado, na ordem em que foram escritas. */
export function perguntasDoLado(lado: "profissional" | "empresa"): Pergunta[] {
  return PERGUNTAS.filter((q) => q.lado === "todos" || q.lado === lado);
}
