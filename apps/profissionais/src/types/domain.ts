export type SubscriptionType = "verification" | "boost" | "plus";
export type SubscriptionStatus = "pending" | "authorized" | "active" | "paused" | "cancelled";
export type BillingCycle = "monthly" | "annual";

export type ContactMode = "whatsapp_livre" | "pay_per_lead";

export interface Profile {
  id: string; // = auth.users.id
  full_name: string | null;
  avatar_url: string | null;
  /* Contato, e não credencial. O e-mail de LOGIN mora em `auth.users`;
     estes dois existem porque cada porta de entrada traz só metade — quem
     entra pelo Google não tem telefone, quem entra pelo número não tem
     e-mail. Ver migration 0064. */
  email: string | null;
  phone: string | null;
  created_at: string;
}

export type EntityType = "pf" | "pj";

export interface Professional {
  id: string;
  owner_id: string; // profiles.id do dono do cadastro
  name: string;
  category: string; // categoria principal (destaque no card, usada no patrocínio)
  categories: string[]; // todos os serviços que a pessoa oferece — é o que a busca consulta
  /** Recorte dentro do ofício: "Ortodontia", "Pintura residencial". */
  especialidade: string | null;
  city: string;
  /** Sigla do estado. Anda sempre junto com `city`. */
  uf: string;
  bio: string;
  phone: string; // telefone para ligação
  whatsapp: string | null;
  email: string | null;
  instagram: string | null; // @usuario ou URL
  linkedin: string | null; // URL do perfil
  /** Endereço de atendimento. Opcional: quem atende na casa do cliente deixa vazio. */
  cep: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  /** Rua e número aparecem no cadastro só quando isto está ligado. */
  mostrar_endereco: boolean;
  entity_type: EntityType; // "pf" = profissional autônomo, "pj" = empresa
  document: string | null; // CPF (pf) ou CNPJ (pj) do anunciante
  company_name: string | null; // razão social/nome fantasia, só relevante para pj
  photo_url: string | null; // foto de rosto (pf) ou logo (pj)
  responsible_name: string | null; // nome do responsável pela empresa, obrigatório só para pj
  /** Posse do número confirmada por código enviado no WhatsApp. */
  whatsapp_verified: boolean;
  whatsapp_verified_at: string | null;
  verified: boolean;
  verified_until: string | null;
  /** Desde quando tem selo, sem contar períodos em que o selo caiu. */
  verified_since: string | null;
  boosted: boolean;
  boosted_until: string | null;
  /** Pausado pelo próprio dono: sai da busca e volta quando ele quiser. */
  paused: boolean;
  /** Etiquetas de atendimento marcadas no cadastro (ver `ATRIBUTOS`). */
  atributos: string[];
  /**
   * Onde a pessoa ACEITARIA trabalhar — diferente de `categories`, que é o
   * que ela FAZ.
   *
   * A distinção é o app de emprego inteiro: um eletricista que topa vaga de
   * auxiliar de produção nunca seria alcançado por ela, porque "auxiliar de
   * produção" não é o ofício dele. Misturar as duas listas estragaria as
   * duas pontas — quem procura um eletricista veria gente que só toparia
   * ser, e a vaga não saberia distinguir quem faz de quem aceitaria.
   *
   * As ondas de uma vaga alcançam pelas duas colunas (ver `ONDAS`).
   */
  areas_de_interesse: string[];
  suspended: boolean; // tirado do ar pelo painel admin (denúncia procedente ou violação das regras)
  suspended_reason: string | null;
  contact_mode: ContactMode; // "whatsapp_livre" (grátis) ou "pay_per_lead" (cobra crédito por contato)
  plus_active: boolean; // plano Empresa Plus (analytics), só para entity_type "pj"
  plus_until: string | null;
  created_at: string;
}

/**
 * Um item da lista de serviços do cadastro.
 *
 * Existe para quem oferece várias coisas diferentes — o hotel com hospedagem
 * e salão de eventos, o laboratório com trinta exames, a loja com ajuste e
 * customização. O autônomo de um serviço só pode ignorar: a lista é
 * opcional.
 *
 * Sem preço, de propósito: o app direciona para a pessoa certa e entrega o
 * contato; quanto custa é conversa entre quem contrata e quem faz.
 */
export interface ServicoOferecido {
  id: string;
  professional_id: string;
  nome: string;
  descricao: string;
  ordem: number;
  created_at: string;
}

/** Teto por cadastro, igual ao do banco. */
export const MAX_SERVICOS_CATALOGO = 40;

/**
 * Uma experiência de trabalho do profissional.
 *
 * Três campos, e é decisão de produto, não preguiça. "Ajudante de pedreiro
 * / Construções Silva / 2 anos" é o que uma empresa da cidade quer saber, e
 * é o que se preenche num celular sem desistir no meio. Currículo com mês e
 * ano de início e fim é mais completo e fica vazio — e experiência não
 * preenchida não ajuda ninguém.
 *
 * `periodo` é texto livre, e não duas datas: quem trabalhou "uns três anos"
 * não lembra o mês, e obrigá-lo a escolher um faz ele inventar ou desistir.
 */
export interface ProfessionalExperience {
  id: string;
  professional_id: string;
  /** "Ajudante de pedreiro". O único obrigatório. */
  cargo: string;
  /** "Construções Silva", ou vazio para quem trabalhou por conta. */
  onde: string | null;
  /** "2 anos", "de 2019 a 2022", "uns 6 meses". */
  periodo: string | null;
  ordem: number;
  created_at: string;
}

/** Teto de experiências por cadastro. Quem tem mais, resume. */
export const MAX_EXPERIENCIAS = 10;

/**
 * Teto de áreas de interesse — maior que o de serviços, e de propósito.
 *
 * O limite de 5 serviços existe porque quem marca tudo não está dizendo
 * nada: um cadastro que aparece em vinte buscas atrapalha as vinte. Aqui a
 * conta é outra. Marcar "aceito vaga de estoquista" não promete nada a
 * ninguém e não polui busca nenhuma — só amplia o que chega para a própria
 * pessoa. Quem está procurando emprego costuma aceitar mais coisas do que
 * sabe fazer, e apertar isso em cinco seria fazê-la escolher entre vagas
 * que ela toparia.
 */
export const MAX_AREAS_DE_INTERESSE = 12;

/**
 * Quantas funções a pessoa pode marcar como "aceito ser chamada".
 *
 * Oito, decidido pela dona. Substitui as DUAS listas que existiam — "o que
 * eu faço" (5, herdada da busca do procurô) e "onde aceito trabalhar" (12).
 * Uma lista só, e é por ela que a vaga chega e que a empresa encontra.
 *
 * O teto existe pela mesma razão de sempre: quem marca tudo não está
 * dizendo nada, e uma pessoa que aparece em oitenta buscas atrapalha as
 * oitenta.
 */
export const MAX_FUNCOES = 8;

/**
 * Banner de publicidade na tela de busca.
 *
 * Vendido pela administração a comércios da cidade — inclusive os que não
 * têm cadastro no app, que é o que diferencia esta receita do selo e do
 * destaque.
 */
export interface Banner {
  id: string;
  anunciante: string;
  titulo: string;
  imagem_url: string;
  /** Externo (site, WhatsApp) ou interno (`/profissional/<id>`). Nulo = sem clique. */
  link: string | null;
  /** Nulo = qualquer cidade. */
  cidade: string | null;
  /** Nulo = qualquer busca; preenchido, só quando filtram por esse serviço. */
  categoria: string | null;
  /** Onde o banner aparece: faixa da busca, ou cartão na tela de boas-vindas. */
  local: "busca" | "boas_vindas";
  inicio: string;
  fim: string;
  ativo: boolean;
  /** Lado comercial. O pagamento acontece fora do app; aqui fica a anotação. */
  contato_anunciante: string | null;
  valor_centavos: number | null;
  pago: boolean;
  observacao: string | null;
  exibicoes: number;
  cliques: number;
  created_at: string;
}

export interface LeadCredits {
  professional_id: string;
  balance: number;
  price_per_lead_cents: number;
  updated_at: string;
}

export interface LeadEvent {
  id: string;
  professional_id: string;
  user_id: string | null;
  created_at: string;
  charged: boolean;
}

export type SponsorshipStatus = "pending" | "active" | "expired";

export interface CategorySponsorship {
  id: string;
  professional_id: string;
  category: string; // categoria principal (destaque no card, usada no patrocínio)
  categories: string[]; // todos os serviços que a pessoa oferece — é o que a busca consulta
  city: string;
  starts_at: string;
  ends_at: string;
  mercadopago_payment_id: string | null;
  status: SponsorshipStatus;
  created_at: string;
}

export interface Review {
  id: string;
  professional_id: string;
  user_id: string;
  rating: number; // 1-5
  /** Etiquetas rápidas tocadas pelo avaliador (ver `tagsForRating`). Pode ser vazio. */
  tags: string[];
  comment: string; // opcional na prática: string vazia quando a pessoa só tocou nas etiquetas
  /** Quem avaliou pediu o contato pelo app — calculado no servidor. */
  contato_confirmado?: boolean;
  /** Declarado por quem avaliou: contratou mesmo o serviço. */
  contratou?: boolean;
  /** Nome e foto de quem avaliou, vindos de `reviews_public`. */
  autor_nome?: string | null;
  autor_foto?: string | null;
  reply: string | null; // resposta do dono do cadastro
  replied_at: string | null;
  created_at: string;
}

/**
 * Etiquetas rápidas da avaliação (modelo 99/Uber): a pessoa avalia tocando
 * em opções prontas, sem precisar escrever nada. São as mesmas para todas as
 * categorias de propósito — texto genérico o bastante para servir de
 * encanador a manicure, e um conjunto único mantém a agregação por
 * profissional comparável.
 */
export const POSITIVE_REVIEW_TAGS: string[] = [
  "Pontual",
  "Preço justo",
  "Educado",
  "Serviço bem feito",
  "Caprichoso",
  "Explicou tudo direitinho",
  "Deixou tudo limpo",
];

export const NEGATIVE_REVIEW_TAGS: string[] = [
  "Atrasou",
  "Cobrou mais que o combinado",
  "Não terminou o serviço",
  "Mal educado",
  "Difícil de falar",
  "Serviço mal feito",
  "Deixou sujeira",
];

/**
 * Nota 3 é uma avaliação mediana ("teve coisa boa e coisa ruim"), então
 * mostra um conjunto misto: as 4 qualidades e os 4 problemas mais comuns.
 */
export const MIXED_REVIEW_TAGS: string[] = [
  ...POSITIVE_REVIEW_TAGS.slice(0, 4),
  ...NEGATIVE_REVIEW_TAGS.slice(0, 4),
];

/**
 * Etiquetas oferecidas para uma nota: 4-5 mostra qualidades, 1-2 mostra
 * problemas, 3 mostra o conjunto misto. A UI usa isso tanto para renderizar
 * os chips quanto para descartar etiquetas que deixaram de fazer sentido
 * quando a pessoa troca a nota.
 */
export function tagsForRating(rating: number): string[] {
  if (rating >= 4) return POSITIVE_REVIEW_TAGS;
  if (rating <= 2) return NEGATIVE_REVIEW_TAGS;
  return MIXED_REVIEW_TAGS;
}

/** Título curto acima das etiquetas, que muda de tom conforme a nota. */
export function tagsPromptForRating(rating: number): string {
  if (rating >= 4) return "O que foi bom?";
  if (rating <= 2) return "O que deu errado?";
  return "O que você achou?";
}

export interface Favorite {
  user_id: string;
  professional_id: string;
  created_at: string;
}

export type ContactRequestStatus = "new" | "contacted" | "archived";

/** Pedido de contato: o cliente deixa o número e pede para ser chamado. */
export interface ContactRequest {
  id: string;
  professional_id: string;
  requester_id: string | null;
  name: string;
  phone: string;
  message: string;
  status: ContactRequestStatus;
  created_at: string;
  contacted_at: string | null;
}

export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface Report {
  id: string;
  professional_id: string;
  reporter_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export type SuggestionStatus = "new" | "reviewed";

export interface Suggestion {
  id: string;
  user_id: string | null;
  message: string;
  status: SuggestionStatus;
  created_at: string;
}

/** Onde o anunciante quer aparecer. "tanto_faz" é resposta legítima. */
export type LocalDeAnuncio = "busca" | "boas_vindas" | "tanto_faz";

export type PedidoDeAnuncioStatus = "novo" | "em_conversa" | "fechado" | "sem_interesse";

/** Alguém pedindo para comprar um espaço de publicidade (migration 0044). */
export interface PedidoDeAnuncio {
  id: string;
  user_id: string | null;
  nome: string;
  contato: string;
  local: LocalDeAnuncio;
  cidade: string | null;
  mensagem: string | null;
  status: PedidoDeAnuncioStatus;
  created_at: string;
}

export const REPORT_REASONS = [
  "Informação falsa",
  "Golpe/fraude",
  "Conteúdo ofensivo",
  "Outro",
] as const;

export interface Subscription {
  id: string;
  professional_id: string;
  type: SubscriptionType;
  mercadopago_subscription_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  billing_cycle: BillingCycle;
  /**
   * true quando o Mercado Pago cobra sozinho (mensal ou anual via
   * `preapproval`, no cartão); false no plano anual à vista no Pix/boleto,
   * que é pagamento único — esse é o caminho que recebe o e-mail de aviso da
   * Edge Function agendada `renew-annual-plans`.
   */
  auto_renew: boolean;
  /** Quando o aviso de renovação deste ciclo foi enviado (null = ainda não). */
  renewal_notified_at: string | null;
  created_at: string;
}

/**
 * Serviços sugeridos no formulário do cadastro.
 *
 * É uma lista de atalhos, não uma grade fechada: quem não se encontra aqui
 * escreve o próprio serviço no campo "Outro". Uma lista curta obrigava gente
 * de ofício real ("Costureira", "Soldador", "Confeiteira") a se esconder atrás
 * de "Outros", e ninguém procura por "Outros" na busca.
 *
 * A ordem é por proximidade de assunto — casa e obra primeiro, depois beleza,
 * saúde, ensino, festas, transporte e serviços de escritório —, porque a
 * pessoa varre os chips com o olho e desiste antes de ler quinze palavras
 * soltas.
 */
export const GRUPOS_DE_SERVICOS = [
  {
    grupo: "Casa e obra",
    itens: [
      "Encanador",
      "Eletricista",
      "Pedreiro",
      "Pintor",
      "Marceneiro",
      "Serralheiro",
      "Vidraceiro",
      "Gesseiro",
      "Marido de aluguel",
      "Montador de móveis",
      "Chaveiro",
      "Jardineiro",
      "Piscineiro",
      "Dedetizador",
      "Diarista",
      "Passadeira",
      "Cuidador de idosos",
      "Babá",
    ],
  },
  {
    grupo: "Técnica e conserto",
    itens: [
      "Técnico em informática",
      "Técnico em celulares",
      "Refrigeração e ar-condicionado",
      "Conserto de eletrodomésticos",
      "Mecânico",
      "Borracheiro",
      "Lavagem de carros",
      "Funilaria e pintura automotiva",
    ],
  },
  {
    grupo: "Beleza e bem-estar",
    itens: [
      "Cabeleireiro",
      "Barbeiro",
      "Manicure",
      "Depilação",
      "Maquiadora",
      "Estética e sobrancelhas",
      "Massagista",
      "Personal trainer",
      "Nutricionista",
      "Fisioterapeuta",
      "Psicólogo",
    ],
  },
  {
    grupo: "Ensino",
    itens: [
      "Professor particular",
      "Professor de inglês",
      "Professor de música",
      "Reforço escolar",
      "Palestrante",
    ],
  },
  {
    grupo: "Festas e imagem",
    itens: [
      "Fotógrafo",
      "Filmagem",
      "Confeiteira",
      "Salgadeira",
      "Cozinheira",
      "Buffet e festas",
      "DJ e som",
      "Decoração de festas",
    ],
  },
  {
    grupo: "Costura e artesanato",
    itens: [
      "Costureira",
      "Sapateiro",
      "Tapeceiro",
      "Artesanato",
    ],
  },
  {
    grupo: "Transporte",
    itens: [
      "Frete e mudanças",
      "Motorista",
      "Motoboy",
    ],
  },
  {
    grupo: "Comércio e hospedagem",
    itens: [
      "Hotel",
      "Pousada",
      "Restaurante",
      "Lanchonete",
      "Padaria",
      "Loja de roupas",
      "Loja de calçados",
      "Papelaria",
      "Material de construção",
      "Autopeças",
      "Farmácia",
      "Pet shop",
      "Mercearia",
      "Floricultura",
      "Ótica",
    ],
  },
  {
    grupo: "Saúde e exames",
    itens: [
      "Laboratório de análises",
      "Clínica médica",
      "Clínica odontológica",
      "Fonoaudiólogo",
      "Terapeuta ocupacional",
      "Enfermagem em casa",
      "Exames de imagem",
    ],
  },
  {
    grupo: "Escritório e serviços",
    itens: [
      "Contador",
      "Advogado",
      "Corretor de imóveis",
      "Designer gráfico",
      "Social media",
      "Costura de uniformes",
      "Segurança e portaria",
      "Veterinário",
      "Banho e tosa",
    ],
  },
] as const;

/**
 * A mesma lista achatada. Os grupos existem para a tela de escolha; o resto
 * do app (filtro da busca, validação, normalização) só precisa saber quais
 * serviços existem, e derivar daqui evita as duas listas saírem do lugar uma
 * da outra.
 */
export const CATEGORIES = GRUPOS_DE_SERVICOS.flatMap((g) => g.itens as readonly string[]);

/**
 * Os ofícios vizinhos de um ofício — os do mesmo grupo, ele incluído.
 *
 * É o que dá sentido à onda 3 das vagas. "Alargar a busca" precisava
 * significar alguma coisa entre "só quem faz exatamente isso" e "a cidade
 * inteira", e o meio-termo já estava escrito: os grupos de
 * `GRUPOS_DE_SERVICOS`, montados para a tela de escolha de serviços.
 *
 * Vaga de pedreiro alcança quem faz "Casa e obra" — pintor, servente,
 * azulejista. Não alcança manicure, e é esse o ponto: a onda que alarga
 * demais é a que ensina a pessoa a ignorar o aviso seguinte.
 *
 * Ofício escrito à mão (fora da lista) não tem grupo. Aí devolve só ele
 * mesmo — alargar para um grupo adivinhado seria pior que não alargar.
 */
export function categoriasDoMesmoGrupo(categoria: string): string[] {
  const grupo = GRUPOS_DE_SERVICOS.find((g) =>
    (g.itens as readonly string[]).includes(categoria)
  );
  return grupo ? [...(grupo.itens as readonly string[])] : [categoria];
}

/**
 * Deixa um serviço escrito à mão no mesmo formato dos sugeridos.
 *
 * Sem isto, "eletricista", "ELETRICISTA" e " Eletricista " virariam três
 * categorias diferentes no filtro da busca — que é montado a partir dos
 * cadastros. Espaços sobrando somem, a primeira letra sobe, e o resto do
 * texto é preservado como a pessoa escreveu (nomes próprios e siglas não
 * podem ser achatados).
 */
export function normalizarCategoria(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

/** Limite do serviço escrito à mão: um ofício, não uma descrição do cadastro. */
export const MAX_CATEGORIA_LEN = 32;

/** Limite da especialidade: um recorte do ofício, não a segunda descrição. */
export const MAX_ESPECIALIDADE_LEN = 60;

/**
 * Cidade padrão do produto hoje ("procurô"). A modelagem já guarda a
 * cidade por profissional em texto livre para permitir expandir para outras
 * cidades sem migração de schema — a busca simplesmente filtra por esse campo.
 */
/** Pacotes de duração do banner de categoria patrocinada, com preço fixo por período. */
export const SPONSORSHIP_PLANS = [
  { days: 7, amount: 29.9 },
  { days: 15, amount: 49.9 },
  { days: 30, amount: 79.9 },
] as const;

/** Teto de serviços por cadastro: quem marca tudo não está dizendo nada. */
export const MAX_CATEGORIES = 5;

/**
 * Etiquetas de atendimento — o "quando" e o "como" do cadastro.
 *
 * O cadastro já diz o que a pessoa faz e onde. O que ele não dizia é
 * exatamente o que quem procura pergunta antes de qualquer outra coisa:
 * atende sábado? dá para hoje? aceita cartão? vai até minha casa? Cada uma
 * dessas perguntas era uma mensagem no WhatsApp que só existia porque o
 * cadastro ficou calado — e boa parte delas morria sem resposta.
 *
 * É uma lista fechada de propósito. Etiqueta escrita à mão vira propaganda
 * ("o melhor da cidade", "preço imbatível"), e aí ninguém mais consegue
 * comparar dois cadastros: se cada um inventa a própria etiqueta, a etiqueta
 * deixa de significar alguma coisa. Serviço é diferente — ofício é da
 * pessoa, e por isso lá o campo livre existe.
 *
 * Agrupadas porque a pessoa lê por assunto: horário é um bloco, forma de
 * atender é outro, pagamento é outro.
 */
export const GRUPOS_DE_ATRIBUTOS = [
  {
    grupo: "Horário",
    itens: [
      "Atende fins de semana",
      "Atende à noite",
      "Só durante a semana",
      "Atende feriados",
      "Atende emergências 24h",
    ],
  },
  {
    grupo: "Como atende",
    itens: [
      "Vou até você",
      "Atendo no meu local",
      "Atendo por vídeo",
      "Orçamento sem compromisso",
      "Levo material",
    ],
  },
  {
    grupo: "Pagamento",
    itens: ["Aceita cartão", "Aceita Pix", "Parcela no cartão", "Emite nota fiscal"],
  },
] as const;

/** A mesma lista achatada — usada para validar o que chega do formulário. */
export const ATRIBUTOS = GRUPOS_DE_ATRIBUTOS.flatMap((g) => g.itens as readonly string[]);

/**
 * Teto de etiquetas por cadastro, igual ao do banco.
 *
 * Oito é generoso de propósito: o limite não está aqui para racionar, está
 * para impedir o cadastro que marca as dezesseis e volta a não informar nada.
 */
export const MAX_ATRIBUTOS = 8;

/** Pacotes de créditos disponíveis para compra no modo "pagar por contato". */
export const CREDIT_PACKS = [10, 25, 50] as const;

export const DEFAULT_CITY = "Itabirito";

export const DEFAULT_UF = "MG";

/**
 * As cidades onde o procurô nasceu.
 *
 * Deixou de ser a lista do que o app aceita: qualquer cidade do Brasil pode
 * ter cadastro. Continua servindo às telas de venda de publicidade, que são
 * as que ainda operam por praça conhecida.
 */
export const CITIES = [DEFAULT_CITY, "Ouro Preto", "Belo Horizonte", "Congonhas"] as const;

/**
 * As 27 siglas, para o seletor de estado.
 *
 * Cidade sem estado não identifica lugar nenhum no Brasil: há "Bom Jesus" em
 * mais de vinte estados, e "Santa Maria", "Boa Vista" e "Bela Vista"
 * espalhadas pelo país. Sem a sigla, duas cidades distantes viram a mesma
 * busca — e a lista vem com gente dentro, sem erro nenhum na tela.
 */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

/** "Itabirito/MG" — como cidade e estado aparecem escritos em toda tela. */
export function cidadeComEstado(city: string, uf: string): string {
  return uf ? `${city}/${uf}` : city;
}

// ===== MVP LOCAL HIRING =====

/** Tipo de usuário na plataforma. */
export type UserType = "professional" | "company";

/** Empresa contratante na plataforma. */
export interface Company {
  id: string;
  owner_id: string; // profiles.id do dono/responsável
  company_name: string; // razão social
  cnpj: string | null;
  city: string; // mesmo padrão do Professional
  uf: string;
  neighborhood: string | null; // bairro/região
  address: string | null; // endereço comercial
  phone: string; // telefone comercial
  email: string | null;
  website: string | null;
  photo_url: string | null; // logo
  responsible_name: string | null; // nome do responsável
  description: string; // descrição da empresa
  /**
   * Telefone confirmado por código, igual ao do profissional.
   *
   * Vale para todo mundo: quem publica vaga é procurado de volta, e um
   * número não provado do lado de quem contrata é o mesmo problema do outro
   * lado — com dinheiro envolvido. Só a função `confirmar_telefone_empresa`
   * liga isto (migration 0071); trocar o número derruba.
   */
  phone_verified: boolean;
  phone_verified_at: string | null;
  /**
   * O plano de anúncio. `null` = nunca assinou.
   *
   * `plano_ate` é quem diz se vale AGORA — data vence sozinha, booleano
   * precisa de alguém para desligar, e esse alguém é uma rotina que um dia
   * falha calada e deixa plano vencido valendo de graça.
   */
  plano: PlanoEmpresa | null;
  plano_ate: string | null;
  plano_recorrente: boolean;
  created_at: string;
}

/** Tipos de trabalho disponíveis. */
export type WorkModality = "presencial" | "remoto" | "hibrido";

/**
 * Quantas ondas cada vaga tem direito a abrir.
 *
 * É por VAGA, e não por mês da empresa. Uma vaga que não encheu precisa
 * alargar a busca, e uma cota mensal faria a empresa escolher entre alargar
 * esta e abrir a próxima — necessidades diferentes disputando o mesmo
 * saldo. Quem recusa de verdade é o banco (gatilho da migration 0072);
 * este número é para a tela avisar antes.
 *
 * A onda 1 sai na criação, então sobra UMA para a empresa abrir. Qual das
 * duas seguintes usar é escolha dela: alargar pouco (onda 2, mesmo ofício)
 * ou alargar até o ramo (onda 3).
 */
export const ONDAS_POR_VAGA = 2;

/** Por quantos dias a vaga fica na área de anúncios. */
export const DIAS_ANUNCIO_VAGA = 30;

/** Avulso paga uma vez e vence; recorrente se renova até alguém cancelar. */
export type CicloDoPlano = "avulso" | "recorrente";

export type PlanoEmpresa = "pro" | "tres" | "ilimitado";

/**
 * Os planos de quem contrata.
 *
 * O plano é a PORTA DA VAGA: sem ele a empresa vê e procura os
 * profissionais como qualquer pessoa — de graça, sem conta —, mas não
 * publica vaga, não dispara onda e não recebe interessado. Com ele, faz as
 * três, e o anúncio na área de anúncios vem junto.
 *
 * Foi assim que ficou depois de uma primeira versão ao contrário, que
 * cobrava pelo anúncio e dava a onda de graça: a onda é a parte valiosa,
 * porque vai atrás de quem encaixa em vez de esperar. Cobrar pelo passivo e
 * dar o ativo deixava o plano sem motivo para existir — bastava publicar,
 * disparar as duas ondas e nunca assinar nada.
 *
 * `vagas` limita quantas ficam ABERTAS ao mesmo tempo, não quantas se
 * publica no total: vaga fechada libera o lugar sozinha, então o plano de
 * uma vaga serve a quem contrata uma de cada vez, que é a maioria.
 *
 * `-1` é sem teto, e é lido em um lugar só (`cabeVagaNoPlano`), para o
 * número mágico não escapar pelo resto do código.
 *
 * Preço em centavos pelo mesmo motivo do banner: valor com vírgula em
 * ponto flutuante rende diferença de um centavo na hora de cobrar, e essa é
 * a diferença que o cliente percebe.
 *
 * ATENÇÃO ao nome: já existe uma assinatura de profissional chamada
 * "Empresa Plus" que custa os mesmos R$ 29,90 (ver PRECOS_MENSAIS em
 * lib/payments.ts). São coisas diferentes com preço igual, e quem atender o
 * telefone vai ouvir "assinei o de 29,90" sem saber qual dos dois.
 */
export const PLANOS_EMPRESA: Record<
  PlanoEmpresa,
  { nome: string; centavos: number; vagas: number; resumo: string; beneficios: string[] }
> = {
  pro: {
    nome: "Pro",
    centavos: 3990,
    vagas: 1,
    resumo: "1 vaga aberta por vez. Fechou uma, abre outra",
    beneficios: [
      "1 vaga aberta por vez",
      "30 dias no ar por vaga, contados da publicação",
      "Aviso para quem tem a função que você procura",
      "Recebe quem se interessou, com telefone",
    ],
  },
  tres: {
    nome: "Premium",
    centavos: 7990,
    vagas: 3,
    resumo: "3 vagas abertas ao mesmo tempo",
    beneficios: [
      "3 vagas abertas ao mesmo tempo",
      "30 dias no ar por vaga, contados da publicação",
      "Aviso para quem tem a função que você procura",
      "Sua vaga aparece na lista de vagas em aberto",
    ],
  },
  ilimitado: {
    nome: "Multi",
    centavos: 11990,
    vagas: -1,
    resumo: "quantas vagas abertas quiser",
    beneficios: [
      "Vagas abertas sem limite",
      "30 dias no ar por vaga, contados da publicação",
      "Aviso para quem tem a função que você procura",
      "Sua vaga aparece na lista de vagas em aberto",
    ],
  },
};

/**
 * O plano de graça, que não é um plano no banco.
 *
 * Ele não entra em `PLANOS_EMPRESA` de propósito: `companies.plano` guarda
 * o que foi PAGO, e um valor "gratuito" ali seria uma assinatura que
 * ninguém assinou — a mesma confusão que faria `cabeVagaNoPlano` achar que
 * há um teto quando não há plano nenhum. Sem plano é `null`, e continua
 * sendo.
 *
 * Ele existe como texto porque a tela precisa mostrá-lo: a dona pediu os
 * planos "desde o free", e omitir o de graça faz o app parecer trancado
 * para quem só quer procurar gente — que é livre, e sempre foi.
 */
export const PLANO_GRATUITO = {
  nome: "Gratuito",
  centavos: 0,
  resumo: "procurar e falar com os profissionais da cidade",
  beneficios: [
    "Ver todos os profissionais da cidade",
    "Falar com cada um pelo telefone do cadastro",
    "Guardar quem te interessou",
  ],
  /* Fora da lista de vistos de propósito: um ✓ verde ao lado de "não
     publica vaga" diz o contrário do que a frase diz. Limitação se escreve
     como limitação. */
  limite: "Não publica vaga e não dispara aviso.",
};

/** "R$ 29,90" — escrito como se lê. */
export function precoDoPlano(plano: PlanoEmpresa): string {
  return (PLANOS_EMPRESA[plano].centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Ainda cabe mais uma vaga anunciada neste plano?
 *
 * O `-1` do ilimitado é entendido aqui, e só aqui. Sem plano (ou vencido)
 * o limite é 0 e não cabe nada — que é a mesma resposta que o banco dá.
 */
export function cabeVagaNoPlano(limite: number, anunciadasAgora: number): boolean {
  if (limite < 0) return true;
  return anunciadasAgora < limite;
}

/** Vaga de trabalho criada por uma empresa. */
export interface JobListing {
  id: string;
  company_id: string;
  title: string; // "Vendedor", "Recepcionista", etc
  description: string; // descrição da vaga
  profession: string; // profissão/categoria (ex: "Vendedor")
  specialty: string | null; // especialidade (ex: "Vendas em loja de roupas")
  required_experience: string | null; // "0-2 anos", "2-5 anos", "5+ anos"
  skills: string[]; // habilidades requeridas (array)
  salary_range_min: number | null; // em centavos
  salary_range_max: number | null; // em centavos
  available_immediately: boolean; // disponibilidade imediata
  work_modality: WorkModality;
  city: string;
  uf: string;
  neighborhood: string | null;
  /**
   * Até quando a vaga fica na área de anúncios. `null` = nunca foi anunciada.
   *
   * Guarda a data-limite, e não um "está anunciada": data vence sozinha,
   * booleano precisa de alguém para desligar — e esse alguém é sempre uma
   * rotina agendada que um dia falha calada, deixando anúncio vencido no ar.
   */
  anunciada_ate: string | null;
  status: "active" | "paused" | "closed";
  created_at: string;
  closed_at: string | null;

  /* ── O que a vaga passou a dizer (migration 0080) ──────────────────
     A dona: "tem que ter todos os campos descritos."

     São as três perguntas que decidem se alguém responde, e nenhuma delas
     existia: se é registrado, que horário, e se tem benefício. Sem elas,
     quem procura só descobria no telefonema — e o telefonema é o que o app
     existe para não desperdiçar.

     Aceitam nulo porque as vagas antigas não têm. Quem exige é o
     formulário, que sabe apontar QUAL campo faltou; um `not null` recusaria
     com um erro do banco, sem dizer qual. */
  tipo_contrato: TipoContrato | null;
  jornada: Jornada | null;
  beneficios: string[];
  /** "A combinar" é uma resposta escrita, e é diferente de campo em branco:
      em branco some da tela e vira indistinguível de esquecimento. */
  salario_a_combinar: boolean;
}

export type TipoContrato =
  | "clt"
  | "temporario"
  | "diaria"
  | "freelance"
  | "estagio"
  | "aprendiz";

export type Jornada =
  | "integral"
  | "meio_periodo"
  | "turnos"
  | "fins_de_semana"
  | "a_combinar";

/* Os nomes em português moram AQUI, e não em cada tela.
   ─────────────────────────────────────────────────────
   A empresa escolhe numa tela e a pessoa lê em outra. Com a tradução
   escrita duas vezes, uma delas envelhece — e o app passa a chamar a mesma
   coisa por dois nomes, sem nada quebrando para avisar. */
export const TIPOS_DE_CONTRATO: Array<{ valor: TipoContrato; nome: string }> = [
  { valor: "clt", nome: "Registrado em carteira (CLT)" },
  { valor: "temporario", nome: "Temporário" },
  { valor: "diaria", nome: "Diária" },
  { valor: "freelance", nome: "Freelance / por conta própria" },
  { valor: "estagio", nome: "Estágio" },
  { valor: "aprendiz", nome: "Jovem aprendiz" },
];

export const JORNADAS: Array<{ valor: Jornada; nome: string }> = [
  { valor: "integral", nome: "Integral (o dia todo)" },
  { valor: "meio_periodo", nome: "Meio período" },
  { valor: "turnos", nome: "Por turno ou escala" },
  { valor: "fins_de_semana", nome: "Fins de semana" },
  { valor: "a_combinar", nome: "A combinar" },
];

/* Os benefícios que aparecem como sugestão. A empresa pode escrever outros:
   a lista é atalho, não gaiola — "cesta básica" e "plano odontológico"
   existem em Itabirito e não caberiam numa lista fechada. */
export const BENEFICIOS_SUGERIDOS = [
  "Vale-transporte",
  "Vale-refeição",
  "Vale-alimentação",
  "Almoço no local",
  "Plano de saúde",
  "Comissão",
  "Adiantamento quinzenal",
];

export function nomeDoContrato(v: TipoContrato | null): string | null {
  return TIPOS_DE_CONTRATO.find((t) => t.valor === v)?.nome ?? null;
}

export function nomeDaJornada(v: Jornada | null): string | null {
  return JORNADAS.find((j) => j.valor === v)?.nome ?? null;
}

/**
 * O salário, escrito como a pessoa lê.
 *
 * Devolve `null` só quando não há resposta nenhuma — e aí a tela diz isso
 * com todas as letras, em vez de omitir a linha. Salário ausente é a
 * informação que mais faz gente não responder a uma vaga; escondê-la não a
 * torna menos ausente, só torna a vaga mais suspeita.
 */
export function salarioEmTexto(v: {
  salario_a_combinar: boolean;
  salary_range_min: number | null;
  salary_range_max: number | null;
}): string | null {
  if (v.salario_a_combinar) return "A combinar";
  /* DIVIDIR POR 100. As colunas guardam CENTAVOS — o formulário grava
     `valor * 100`. Sem esta divisão, um salário de R$ 1.800 aparecia como
     "R$ 180.000" na tela de quem procura: cem vezes maior, com cara de
     número real, e sem nada quebrando para avisar. Passou pela conferência
     de tipos e pelo build; só apareceu ao abrir a tela. */
  const reais = (n: number) =>
    (n / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  const { salary_range_min: min, salary_range_max: max } = v;
  if (min != null && max != null) {
    /* Mínimo igual ao máximo é salário FIXO, e escrever "de R$ 2.000 a
       R$ 2.000" faz a empresa parecer que não sabe o que paga. */
    return min === max ? reais(min) : `${reais(min)} a ${reais(max)}`;
  }
  if (min != null) return `A partir de ${reais(min)}`;
  if (max != null) return `Até ${reais(max)}`;
  return null;
}

/** Onda de disparo (onda 1, 2 ou 3). */
export type WaveNumber = 1 | 2 | 3;

/**
 * As ondas: quem a vaga alcança, e em que ordem.
 *
 * A primeira versão disto abria por DISTÂNCIA — onda 1 "os mais próximos",
 * onda 3 "a cidade inteira". Estava errado duas vezes.
 *
 * Errado nos dados: o cadastro guarda bairro, CEP, cidade e estado. Não há
 * latitude nem longitude em lugar nenhum, então quilômetro não é uma conta
 * que este banco saiba fazer. O campo `distance_radius_km` existia na vaga
 * e nenhuma consulta poderia usá-lo.
 *
 * Errado na cidade: Itabirito inteira se atravessa em dez minutos. Ordenar
 * por proximidade aqui é ordenar por ruído — a diferença entre o primeiro e
 * o último colocado não muda a decisão de ninguém.
 *
 * E a onda 3 antiga ("todo mundo da cidade") era o pior dos três: mandava
 * vaga de pedreiro para manicure. Uma vez cada, e a pessoa silencia o app —
 * aí a vaga seguinte, a que era mesmo dela, não chega mais.
 *
 * O que sobrou é o eixo que os dados sustentam: **o encaixe**, do mais
 * exato para o mais largo. E ele para no ramo — nunca alcança quem não tem
 * nada a ver com o serviço.
 */
export const ONDAS: Record<WaveNumber, { titulo: string; explicacao: string }> = {
  1: {
    titulo: "Quem é exatamente isso",
    explicacao: "Faz esse serviço e a especialidade bate.",
  },
  2: {
    titulo: "Quem faz esse serviço",
    explicacao: "Mesmo ofício, qualquer especialidade.",
  },
  3: {
    titulo: "Quem faz coisa do mesmo ramo",
    explicacao: "Ofícios vizinhos, do mesmo grupo de serviços.",
  },
};

/** Disparo de uma vaga para profissionais (sistema de ondas). */
export interface JobDispatch {
  id: string;
  job_listing_id: string;
  wave: WaveNumber;
  professionals_count: number; // quantas pessoas a onda alcançou
  /**
   * Quantas delas TÊM aparelho que receba notificação.
   *
   * A diferença entre este número e o de cima é a verdade sobre o alcance:
   * push só chega em quem instalou o app e aceitou receber, e no iPhone só
   * em quem adicionou à tela de início. Mostrar só "alcançou 12" venderia
   * um alcance que não existe.
   *
   * `null` é "não deu para contar", e a tela esconde em vez de escrever
   * zero — zero seria inventar a pior notícia possível.
   */
  podiam_receber: number | null;
  sent_at: string;
  status: "pending" | "sent" | "closed";
}

/** Resposta de um profissional a uma vaga (confirmou interesse). */
export interface JobResponse {
  id: string;
  job_listing_id: string;
  professional_id: string;
  responded_at: string;
  status: "new" | "contacted" | "archived";
}

/** Tipo de onboarding: profissional ou empresa. */
export interface UserOnboarding {
  user_id: string;
  user_type: UserType; // "professional" ou "company"
  completed: boolean;
  completed_at: string | null;
}
