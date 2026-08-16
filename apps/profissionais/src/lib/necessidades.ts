/**
 * Traduz o que a pessoa precisa para o ofício de quem faz.
 *
 * Ninguém acorda pensando "preciso de um eletricista". Pensa "o chuveiro
 * parou". Ninguém pensa "confeiteira": pensa "cesta de café da manhã para
 * o dia das mães". A busca do app só sabia procurar pelo nome do ofício,
 * pelo texto do cadastro e pela categoria — ou seja, exigia que a pessoa
 * já soubesse a resposta para poder fazer a pergunta.
 *
 * Quem não sabe o nome do ofício tinha três saídas: adivinhar, abrir a
 * lista inteira de categorias, ou desistir. As duas primeiras dão trabalho
 * e a terceira é a que acontece.
 *
 * Aqui mora a ponte. Cada entrada liga expressões do dia a dia a um ou mais
 * ofícios do catálogo. A busca usa isso para procurar também nas categorias
 * certas, sem que a pessoa precise saber o nome delas.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **Uma necessidade pode levar a mais de um ofício, e leva mesmo.**
 *    "Chuveiro" é o exemplo perfeito: chuveiro que não esquenta é
 *    eletricista, chuveiro que vaza é encanador. Quem digita só "chuveiro"
 *    merece ver os dois; quem digita "chuveiro vazando" vê o encanador
 *    primeiro, porque a expressão mais longa que casou é a que manda.
 *
 * 2. **Acento e maiúscula não contam.** Quem digita rápido no celular
 *    escreve "cafe da manha", e recusar isso seria recusar a maioria.
 */

const CATEGORIA_POR_NECESSIDADE: { termos: string[]; categorias: string[] }[] = [
  // --- Casa: água, luz, obra -------------------------------------------
  { termos: ["chuveiro nao esquenta", "chuveiro queimado", "chuveiro queimou", "trocar chuveiro", "consertar chuveiro", "chuveiro"], categorias: ["Eletricista", "Encanador"] },
  { termos: ["chuveiro vazando", "cano estourado", "cano vazando", "vazamento", "torneira pingando", "torneira vazando", "vaso entupido", "pia entupida", "ralo entupido", "entupimento", "desentupir", "caixa d agua", "encanamento", "esgoto"], categorias: ["Encanador"] },
  { termos: ["tomada nao funciona", "curto circuito", "disjuntor", "falta de luz em casa", "fiacao", "fiação", "trocar lampada", "instalar lustre", "instalar ventilador de teto", "quadro de luz", "choque na torneira", "energia", "instalacao eletrica"], categorias: ["Eletricista"] },
  { termos: ["levantar parede", "rebocar", "reboco", "assentar piso", "colocar piso", "azulejo", "reforma", "construir", "muro", "calcada", "laje", "telhado", "goteira", "infiltracao"], categorias: ["Pedreiro"] },
  { termos: ["pintar a casa", "pintar parede", "pintura", "tinta na parede", "textura na parede"], categorias: ["Pintor"] },
  { termos: ["forro de gesso", "gesso", "drywall", "sanca"], categorias: ["Gesseiro"] },
  { termos: ["portao", "portão", "grade", "solda", "estrutura de ferro", "corrimao"], categorias: ["Serralheiro"] },
  { termos: ["vidro quebrado", "box do banheiro", "janela de vidro", "espelho sob medida"], categorias: ["Vidraceiro"] },
  { termos: ["movel sob medida", "armario planejado", "guarda roupa planejado", "marcenaria", "porta de madeira"], categorias: ["Marceneiro"] },
  { termos: ["montar movel", "montar armario", "montar guarda roupa", "montar cama", "desmontar movel"], categorias: ["Montador de móveis"] },
  { termos: ["chave trancada", "perdi a chave", "copia de chave", "fechadura", "abrir porta", "tranca"], categorias: ["Chaveiro"] },
  { termos: ["pequenos reparos", "consertar em casa", "furar parede", "instalar prateleira", "instalar varal", "instalar suporte de tv", "colocar quadro na parede"], categorias: ["Marido de aluguel"] },
  { termos: ["cortar grama", "podar", "poda", "jardim", "roçar", "rocar", "paisagismo", "grama alta"], categorias: ["Jardineiro"] },
  { termos: ["limpar piscina", "tratar piscina", "agua da piscina verde"], categorias: ["Piscineiro"] },
  { termos: ["barata", "cupim", "formiga", "rato", "escorpiao", "pulga", "dedetizar", "praga"], categorias: ["Dedetizador"] },
  { termos: ["limpar a casa", "faxina", "limpeza", "faxineira", "limpeza pesada", "arrumar a casa"], categorias: ["Diarista"] },
  { termos: ["passar roupa", "roupa amassada"], categorias: ["Passadeira"] },
  { termos: ["cuidar de idoso", "cuidar da minha mae", "cuidar do meu pai", "acompanhante de idoso"], categorias: ["Cuidador de idosos"] },
  { termos: ["cuidar de crianca", "cuidar do bebe", "baba", "babá", "olhar meu filho"], categorias: ["Babá"] },

  // --- Conserto de coisas ----------------------------------------------
  { termos: ["computador lento", "formatar computador", "notebook nao liga", "computador nao liga", "virus no computador", "instalar programa", "internet nao funciona", "wifi"], categorias: ["Técnico em informática"] },
  { termos: ["tela quebrada", "trocar tela do celular", "celular nao carrega", "bateria do celular", "celular molhou", "consertar celular"], categorias: ["Técnico em celulares"] },
  { termos: ["geladeira nao gela", "ar condicionado", "limpeza de ar condicionado", "instalar ar condicionado", "freezer nao gela", "camara fria"], categorias: ["Refrigeração e ar-condicionado"] },
  { termos: ["maquina de lavar", "fogao nao acende", "microondas", "consertar geladeira", "eletrodomestico quebrado", "liquidificador", "forno eletrico"], categorias: ["Conserto de eletrodomésticos"] },
  { termos: ["carro nao liga", "barulho no motor", "revisao do carro", "troca de oleo", "embreagem", "freio do carro", "mecanica"], categorias: ["Mecânico"] },
  { termos: ["pneu furado", "calibrar pneu", "trocar pneu", "borracharia"], categorias: ["Borracheiro"] },
  { termos: ["lavar o carro", "lavagem a seco", "polimento do carro", "higienizacao de banco"], categorias: ["Lavagem de carros"] },
  { termos: ["bateu o carro", "amassado no carro", "pintura do carro", "risco no carro", "lataria"], categorias: ["Funilaria e pintura automotiva"] },
  { termos: ["consertar sapato", "trocar salto", "colar tenis", "sola descolando"], categorias: ["Sapateiro"] },
  { termos: ["reformar sofa", "trocar tecido do sofa", "estofado", "reformar cadeira"], categorias: ["Tapeceiro"] },
  { termos: ["ajustar roupa", "bainha", "costurar", "consertar roupa", "vestido sob medida", "reformar roupa"], categorias: ["Costureira"] },

  // --- Festa, comida, presente -----------------------------------------
  { termos: ["cesta de cafe da manha", "cesta de cafe", "cafe da manha", "cesta de presente", "cesta"], categorias: ["Confeiteira", "Salgadeira"] },
  { termos: ["bolo de aniversario", "bolo", "doces para festa", "brigadeiro", "torta doce", "bem casado", "cupcake"], categorias: ["Confeiteira"] },
  { termos: ["salgados para festa", "coxinha", "salgadinho", "kit festa", "quentinha", "salgados"], categorias: ["Salgadeira"] },
  { termos: ["cozinhar para evento", "almoco para familia", "comida caseira", "marmita"], categorias: ["Cozinheira"] },
  { termos: ["festa de aniversario", "casamento", "formatura", "buffet", "aniversario infantil"], categorias: ["Buffet e festas", "Decoração de festas"] },
  { termos: ["decorar festa", "balao", "painel de festa", "mesa decorada", "arco de baloes"], categorias: ["Decoração de festas"] },
  { termos: ["som para festa", "dj", "musica ao vivo", "caixa de som", "iluminacao de festa"], categorias: ["DJ e som"] },
  { termos: ["fotografo", "ensaio fotografico", "fotos de aniversario", "book", "foto"], categorias: ["Fotógrafo"] },
  { termos: ["filmar", "video de casamento", "drone", "gravar video"], categorias: ["Filmagem"] },
  { termos: ["flores", "buque", "arranjo de flores", "coroa de flores"], categorias: ["Floricultura"] },

  // --- Beleza e saúde ---------------------------------------------------
  { termos: ["cortar cabelo", "pintar cabelo", "escova", "progressiva", "luzes no cabelo", "penteado", "cabelo"], categorias: ["Cabeleireiro"] },
  { termos: ["cortar barba", "barba", "corte masculino", "degrade"], categorias: ["Barbeiro"] },
  { termos: ["fazer as unhas", "unha", "esmalte", "alongamento de unha", "pe e mao", "manicure"], categorias: ["Manicure"] },
  { termos: ["depilar", "cera", "depilacao a laser"], categorias: ["Depilação"] },
  { termos: ["maquiagem", "me maquiar", "maquiagem para festa", "noiva"], categorias: ["Maquiadora"] },
  { termos: ["sobrancelha", "design de sobrancelha", "limpeza de pele", "estetica"], categorias: ["Estética e sobrancelhas"] },
  { termos: ["massagem", "dor nas costas", "relaxante", "drenagem"], categorias: ["Massagista", "Fisioterapeuta"] },
  { termos: ["emagrecer", "dieta", "reeducacao alimentar", "nutricao"], categorias: ["Nutricionista"] },
  { termos: ["treinar", "academia", "exercicio", "personal"], categorias: ["Personal trainer"] },
  { termos: ["fisioterapia", "recuperacao de lesao", "pos operatorio", "dor no joelho"], categorias: ["Fisioterapeuta"] },
  { termos: ["terapia", "ansiedade", "depressao", "psicologo", "conversar com alguem"], categorias: ["Psicólogo"] },
  { termos: ["exame de sangue", "exame", "coleta"], categorias: ["Laboratório de análises"] },
  { termos: ["consulta medica", "medico"], categorias: ["Clínica médica"] },
  { termos: ["dentista", "dente", "aparelho nos dentes", "limpeza nos dentes", "canal"], categorias: ["Clínica odontológica"] },
  { termos: ["fala da crianca", "gagueira", "fonoaudiologia"], categorias: ["Fonoaudiólogo"] },
  { termos: ["injecao em casa", "curativo", "enfermeira em casa", "acompanhamento de saude em casa"], categorias: ["Enfermagem em casa"] },
  { termos: ["raio x", "ultrassom", "tomografia", "ressonancia"], categorias: ["Exames de imagem"] },
  { termos: ["oculos", "grau", "lente de contato"], categorias: ["Ótica"] },
  { termos: ["remedio", "farmacia de plantao"], categorias: ["Farmácia"] },

  // --- Bichos ------------------------------------------------------------
  { termos: ["meu cachorro esta doente", "gato doente", "vacina do cachorro", "castrar", "veterinario"], categorias: ["Veterinário"] },
  { termos: ["banho no cachorro", "tosa", "banho e tosa", "tosar"], categorias: ["Banho e tosa"] },
  { termos: ["racao", "ração", "comida de cachorro", "areia de gato", "coleira"], categorias: ["Pet shop"] },

  // --- Ensino ------------------------------------------------------------
  { termos: ["aula particular", "reforco", "meu filho esta com dificuldade", "matematica", "portugues", "professor"], categorias: ["Professor particular", "Reforço escolar"] },
  { termos: ["aprender ingles", "aula de ingles", "ingles"], categorias: ["Professor de inglês"] },
  { termos: ["aula de violao", "aula de musica", "aprender teclado", "aula de canto"], categorias: ["Professor de música"] },

  // --- Transporte e mudança ---------------------------------------------
  { termos: ["mudanca", "mudança", "carreto", "frete", "levar movel", "transportar"], categorias: ["Frete e mudanças"] },
  { termos: ["motorista particular", "levar ao aeroporto", "viagem de carro"], categorias: ["Motorista"] },
  { termos: ["entrega rapida", "entregar documento", "moto entrega", "levar encomenda"], categorias: ["Motoboy"] },

  // --- Escritório e documentos -------------------------------------------
  { termos: ["imposto de renda", "abrir empresa", "mei", "contabilidade", "nota fiscal"], categorias: ["Contador"] },
  { termos: ["processo", "divorcio", "inventario", "advogado", "trabalhista", "direito"], categorias: ["Advogado"] },
  { termos: ["alugar casa", "comprar casa", "vender imovel", "aluguel", "imovel", "terreno"], categorias: ["Corretor de imóveis"] },
  { termos: ["logo", "logotipo", "cartao de visita", "arte para post", "banner"], categorias: ["Designer gráfico"] },
  { termos: ["cuidar do instagram", "post para rede social", "divulgar meu negocio", "rede social"], categorias: ["Social media"] },
  { termos: ["seguranca para evento", "porteiro", "vigia"], categorias: ["Segurança e portaria"] },
  { termos: ["uniforme", "camiseta bordada", "bordado"], categorias: ["Costura de uniformes"] },

  // --- Comércio ----------------------------------------------------------
  { termos: ["material de obra", "cimento", "tijolo", "areia", "tinta para comprar"], categorias: ["Material de construção"] },
  { termos: ["peca de carro", "autopeca", "pastilha de freio"], categorias: ["Autopeças"] },
  { termos: ["comprar roupa", "roupa nova", "loja de roupa"], categorias: ["Loja de roupas"] },
  { termos: ["comprar sapato", "tenis", "sandalia"], categorias: ["Loja de calçados"] },
  { termos: ["caderno", "material escolar", "impressao", "xerox"], categorias: ["Papelaria"] },
  { termos: ["pao", "pão", "padaria", "salgado na hora"], categorias: ["Padaria"] },
  { termos: ["almocar", "restaurante", "comer fora", "self service"], categorias: ["Restaurante"] },
  { termos: ["lanche", "hamburguer", "pizza", "lanchonete"], categorias: ["Lanchonete"] },
  { termos: ["dormir", "hospedagem", "hotel", "pousada", "onde ficar"], categorias: ["Hotel", "Pousada"] },
  { termos: ["mercado", "compras do mes", "mercearia"], categorias: ["Mercearia"] },
];

/** Sem acento, sem maiúscula, sem espaço sobrando. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    /* Escrito como escape e não com os acentos literais: os caracteres
       combinantes são invisíveis no editor, e um deles apagado sem querer
       passa despercebido para sempre. */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Os ofícios que atendem o que a pessoa escreveu — vazio quando o texto não
 * é uma necessidade reconhecida (que é a maioria das buscas: nome de
 * pessoa, nome de empresa, o próprio ofício).
 *
 * A expressão mais longa vence. "Chuveiro vazando" casa tanto com
 * "chuveiro" (eletricista e encanador) quanto com "chuveiro vazando"
 * (encanador); ordenar por tamanho põe o encanador na frente, que é quem
 * conserta um vazamento.
 *
 * O teto de três ofícios não é economia: uma busca que devolve meia cidade
 * não respondeu nada. Se a necessidade é vaga demais para caber em três
 * ofícios, ela é vaga demais para ser respondida por uma lista.
 */
export function oficiosParaNecessidade(texto: string): string[] {
  const alvo = normalizar(texto);
  if (alvo.length < 3) return [];

  const casaram: { termo: string; categorias: string[] }[] = [];
  for (const entrada of CATEGORIA_POR_NECESSIDADE) {
    for (const termo of entrada.termos) {
      const t = normalizar(termo);
      /* `includes` nos dois sentidos: "preciso trocar o chuveiro" contém
         "chuveiro", e "chuveir" (quem parou de digitar no meio) está
         contido em "chuveiro". O segundo caso é o que salva a busca de
         quem escreve devagar no celular e já toca em buscar. */
      if (alvo.includes(t) || (alvo.length >= 4 && t.includes(alvo))) {
        casaram.push({ termo: t, categorias: entrada.categorias });
        break;
      }
    }
  }

  casaram.sort((a, b) => b.termo.length - a.termo.length);
  const saida: string[] = [];
  for (const { categorias } of casaram) {
    for (const c of categorias) if (!saida.includes(c)) saida.push(c);
  }
  return saida.slice(0, 3);
}
