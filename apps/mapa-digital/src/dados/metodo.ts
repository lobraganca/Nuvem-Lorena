// O método inteiro mora neste arquivo.
//
// Isso é de propósito: a plataforma que serviu de referência
// (trix.pqv.ai/pilar/1/pesquisa-passiva) não pôde ser aberta daqui — o
// container bloqueia o domínio —, então os pilares e as perguntas abaixo são
// uma primeira versão, escrita para o objetivo declarado: "mapear o que eu
// quero criar no digital".
//
// Quando as telas de referência chegarem, o que muda é ESTE arquivo — nenhuma
// tela, nenhuma rota, nenhum salvamento. Foi por isso que o conteúdo saiu do
// código das telas e virou dado.

export type Campo = {
  // Entra na chave do que fica salvo. Renomear um id equivale a apagar a
  // resposta de quem já respondeu — na dúvida, crie um id novo.
  id: string;
  pergunta: string;
  ajuda?: string;
  exemplo?: string;
  // Altura do campo. Pergunta de lista pede mais espaço que pergunta de frase.
  linhas?: number;
};

export type Etapa = {
  // Vai na barra de endereço: /pilar/1/pesquisa-passiva
  slug: string;
  nome: string;
  resumo: string;
  campos: Campo[];
};

export type Pilar = {
  numero: number;
  nome: string;
  proposito: string;
  etapas: Etapa[];
};

export const PILARES: Pilar[] = [
  {
    numero: 1,
    nome: "Descoberta",
    proposito:
      "Entender o problema antes de inventar a solução. Quase toda ideia que morre no digital morreu aqui, por pular esta parte.",
    etapas: [
      {
        slug: "pesquisa-passiva",
        nome: "Pesquisa passiva",
        resumo:
          "O que dá para descobrir sem perguntar nada a ninguém. As pessoas já escreveram o que precisam — em busca, em grupo, em avaliação de uma estrela. Aqui você só recolhe.",
        campos: [
          {
            id: "o-que-procuram",
            pergunta:
              "O que as pessoas digitam quando têm esse problema?",
            ajuda:
              "Escreva as frases exatas, do jeito torto que elas digitam. É diferente do nome bonito que a gente dá para o negócio.",
            exemplo:
              "\"conserto de geladeira itabirito barato\", \"quem arruma fogão perto de mim\"",
            linhas: 4,
          },
          {
            id: "onde-conversam",
            pergunta:
              "Em que grupos, páginas ou aplicativos elas já conversam sobre isso?",
            ajuda:
              "Grupo de WhatsApp, Facebook da cidade, comentário de vídeo, Reclame Aqui. Anote o nome e o link.",
            linhas: 4,
          },
          {
            id: "o-que-reclamam",
            pergunta: "Quais reclamações se repetem?",
            ajuda:
              "Reclamação repetida é pedido de compra disfarçado. Olhe as avaliações de 1 e 2 estrelas de quem já faz isso.",
            linhas: 5,
          },
          {
            id: "palavras-delas",
            pergunta: "Com que palavras elas descrevem o problema?",
            ajuda:
              "Copie o vocabulário, não traduza. Um site escrito com as palavras do dono não é encontrado por ninguém.",
            linhas: 3,
          },
          {
            id: "o-que-ja-existe",
            pergunta: "O que já existe resolvendo isso hoje?",
            ajuda:
              "Inclusive o jeito improvisado: caderno, planilha, grupo de zap. O concorrente mais forte quase sempre é \"do jeito que a gente sempre fez\".",
            linhas: 4,
          },
          {
            id: "sinal-de-demanda",
            pergunta:
              "Que sinal você já viu de que existe gente querendo isso?",
            ajuda:
              "Gente perguntando, gente pagando, gente esperando. Se não achou nenhum sinal, isso também é uma resposta — e das úteis.",
            linhas: 3,
          },
        ],
      },
      {
        slug: "pesquisa-ativa",
        nome: "Pesquisa ativa",
        resumo:
          "Agora sim, perguntar. Cinco conversas de verdade valem mais que cem respostas de formulário — e elas só rendem depois da pesquisa passiva, porque aí você já sabe o que perguntar.",
        campos: [
          {
            id: "com-quem-falar",
            pergunta: "Com quem você precisa conversar? (nomes, não perfis)",
            ajuda:
              "Cinco pessoas que vivem o problema. Nome e como chegar em cada uma.",
            linhas: 4,
          },
          {
            id: "perguntas",
            pergunta: "O que perguntar?",
            ajuda:
              "Pergunte sobre o passado (\"como foi a última vez que...\"), não sobre o futuro (\"você usaria...\"). Todo mundo diz que usaria.",
            linhas: 4,
          },
          {
            id: "o-que-ouviu",
            pergunta: "O que você ouviu?",
            ajuda: "Frases das pessoas, com aspas. Resumo já é interpretação.",
            linhas: 6,
          },
          {
            id: "o-que-surpreendeu",
            pergunta: "O que te surpreendeu — e derrubou algum palpite seu?",
            linhas: 3,
          },
        ],
      },
      {
        slug: "concorrencia",
        nome: "Quem já faz",
        resumo:
          "Concorrente não é inimigo: é pesquisa pronta e de graça. Se ninguém faz, desconfie — pode ser brecha, pode ser que não dê dinheiro.",
        campos: [
          {
            id: "quem-sao",
            pergunta: "Quem são, e o que cada um cobra?",
            linhas: 5,
          },
          {
            id: "o-que-fazem-bem",
            pergunta: "O que eles fazem bem?",
            ajuda: "O que você teria de igualar para alguém te considerar.",
            linhas: 4,
          },
          {
            id: "brecha",
            pergunta: "Onde está a brecha?",
            ajuda:
              "O que os clientes deles reclamam, quem eles ignoram, o que é caro demais para o que entrega.",
            linhas: 4,
          },
        ],
      },
    ],
  },
  {
    numero: 2,
    nome: "Público",
    proposito:
      "Para quem, exatamente. \"Para todo mundo\" é o mesmo que para ninguém: não dá para escrever um anúncio, escolher um canal nem definir um preço.",
    etapas: [
      {
        slug: "quem-e",
        nome: "Quem é",
        resumo: "Uma pessoa só, com nome. Não um segmento.",
        campos: [
          {
            id: "retrato",
            pergunta: "Se fosse uma pessoa só, quem seria?",
            ajuda: "Idade, trabalho, rotina, quanto ganha, quanto entende de internet.",
            linhas: 5,
          },
          {
            id: "dia-dela",
            pergunta: "Como é o dia dessa pessoa, na hora em que o problema aparece?",
            linhas: 4,
          },
        ],
      },
      {
        slug: "dores-e-desejos",
        nome: "Dor e desejo",
        resumo:
          "O que dói hoje e o que ela gostaria que fosse verdade amanhã. A diferença entre os dois é o que você vende.",
        campos: [
          { id: "dor", pergunta: "O que dói — e quanto custa essa dor?", ajuda: "Em dinheiro, em tempo ou em vergonha.", linhas: 4 },
          { id: "desejo", pergunta: "O que ela quer que seja verdade depois?", linhas: 4 },
          {
            id: "medo",
            pergunta: "O que a impede de resolver isso hoje?",
            ajuda: "Preço, medo de golpe, não saber que existe, já ter tentado e dado errado.",
            linhas: 4,
          },
        ],
      },
      {
        slug: "onde-encontrar",
        nome: "Onde encontrar",
        resumo: "Onde essa pessoa já está. Você vai até ela; ela não vem até você.",
        campos: [
          { id: "lugares", pergunta: "Em que lugares (digitais e de rua) ela está?", linhas: 4 },
          { id: "quem-ela-ouve", pergunta: "Em quem ela confia quando precisa de indicação?", linhas: 3 },
        ],
      },
    ],
  },
  {
    numero: 3,
    nome: "Proposta",
    proposito:
      "O que você vai criar, dito em uma frase que a pessoa entende sem você por perto.",
    etapas: [
      {
        slug: "promessa",
        nome: "A promessa",
        resumo: "Uma frase. Se não couber em uma, ainda não está claro.",
        campos: [
          {
            id: "frase",
            pergunta: "Complete: eu ajudo ______ a ______ sem ______.",
            exemplo:
              "Eu ajudo quem procura serviço em Itabirito a achar um profissional de confiança sem depender de grupo de WhatsApp.",
            linhas: 3,
          },
          {
            id: "por-que-voce",
            pergunta: "Por que você, e não outra pessoa?",
            linhas: 3,
          },
        ],
      },
      {
        slug: "entrega",
        nome: "O que a pessoa recebe",
        resumo: "Na prática, no concreto. Nada de \"solução completa\".",
        campos: [
          { id: "o-que-recebe", pergunta: "O que ela recebe, item por item?", linhas: 5 },
          { id: "cobranca", pergunta: "Como entra dinheiro?", ajuda: "Quem paga, quanto, com que frequência e por qual meio.", linhas: 4 },
          { id: "custo", pergunta: "O que custa para você manter isso de pé por mês?", linhas: 3 },
        ],
      },
      {
        slug: "limites",
        nome: "O que isso não é",
        resumo:
          "A lista do que fica de fora. É ela que impede o projeto de virar três projetos e não terminar nenhum.",
        campos: [
          { id: "fora", pergunta: "O que fica de fora da primeira versão?", linhas: 5 },
          { id: "depois", pergunta: "O que fica para depois — e depois de qual sinal?", linhas: 4 },
        ],
      },
    ],
  },
  {
    numero: 4,
    nome: "Presença",
    proposito:
      "Onde você aparece e o que você fala. Presença é a parte que se sustenta no tempo — ou não se sustenta.",
    etapas: [
      {
        slug: "canais",
        nome: "Canais",
        resumo:
          "Dois, no máximo. Estar em seis canais mal cuidados é pior do que estar em um bem cuidado.",
        campos: [
          { id: "escolhidos", pergunta: "Quais canais, e por que esses?", ajuda: "Ligue cada canal ao lugar onde você disse, no Pilar 2, que a pessoa está.", linhas: 4 },
          { id: "descartados", pergunta: "Quais você decidiu NÃO usar?", linhas: 3 },
        ],
      },
      {
        slug: "conteudo",
        nome: "Assunto",
        resumo:
          "Três assuntos sobre os quais você consegue falar por um ano sem enjoar e sem precisar pesquisar do zero.",
        campos: [
          { id: "assuntos", pergunta: "Quais são os três assuntos?", linhas: 4 },
          { id: "primeiras-dez", pergunta: "Escreva dez ideias de publicação agora.", ajuda: "Saem das reclamações que você anotou na pesquisa passiva.", linhas: 8 },
        ],
      },
      {
        slug: "ritmo",
        nome: "Ritmo",
        resumo:
          "Quanto você aguenta manter na pior semana do mês — essa é a sua frequência real.",
        campos: [
          { id: "frequencia", pergunta: "Quanto por semana, e em que dia?", linhas: 3 },
          { id: "quem-faz", pergunta: "Quem faz? E se você ficar doente na semana?", linhas: 3 },
        ],
      },
    ],
  },
  {
    numero: 5,
    nome: "Prova",
    proposito:
      "Como você vai saber que está funcionando — combinado antes, não depois. Sem isso, qualquer resultado vira \"acho que está indo bem\".",
    etapas: [
      {
        slug: "metas",
        nome: "O que medir",
        resumo:
          "Poucos números, escolhidos agora. Número que você só olha quando está bom não serve para decidir nada.",
        campos: [
          { id: "numeros", pergunta: "Quais números você vai olhar toda semana?", linhas: 4 },
          { id: "meta-90-dias", pergunta: "Em 90 dias, o que precisa ter acontecido para valer a pena?", linhas: 4 },
          { id: "desistir", pergunta: "E o que faria você parar?", ajuda: "Combine agora, enquanto ainda não dói.", linhas: 3 },
        ],
      },
      {
        slug: "primeiro-passo",
        nome: "Primeiro passo",
        resumo: "A menor coisa que pode ir para o ar em sete dias.",
        campos: [
          { id: "sete-dias", pergunta: "O que vai para o ar em sete dias?", linhas: 4 },
          { id: "quem-testa", pergunta: "Quem são as cinco primeiras pessoas que vão usar?", ajuda: "Nomes. Convite feito, não \"vou divulgar\".", linhas: 4 },
          { id: "data", pergunta: "Qual é a data?", linhas: 2 },
        ],
      },
    ],
  },
];

// Atalhos usados pelas telas. Ficam aqui para ninguém varrer o array na mão e
// esquecer o caso de "pilar que não existe" — que é o que acontece quando
// alguém edita a barra de endereço.

export function acharPilar(numero: string | undefined): Pilar | undefined {
  return PILARES.find((p) => String(p.numero) === numero);
}

export function acharEtapa(
  pilar: Pilar | undefined,
  slug: string | undefined,
): Etapa | undefined {
  return pilar?.etapas.find((e) => e.slug === slug);
}

export type Endereco = { pilar: Pilar; etapa: Etapa };

/** Todas as etapas em ordem, para "próxima" e "anterior" atravessarem pilares. */
export const TRILHA: Endereco[] = PILARES.flatMap((pilar) =>
  pilar.etapas.map((etapa) => ({ pilar, etapa })),
);

export const TOTAL_DE_CAMPOS = TRILHA.reduce(
  (soma, { etapa }) => soma + etapa.campos.length,
  0,
);

export function caminho(pilar: Pilar, etapa: Etapa): string {
  return `/pilar/${pilar.numero}/${etapa.slug}`;
}

/** A chave do que fica salvo. Muda uma vez só: mudou, respostas somem. */
export function chaveDoCampo(pilar: Pilar, etapa: Etapa, campo: Campo): string {
  return `${pilar.numero}.${etapa.slug}.${campo.id}`;
}
