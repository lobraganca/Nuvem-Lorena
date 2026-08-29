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
  created_at: string;
}

/** Tipos de trabalho disponíveis. */
export type WorkModality = "presencial" | "remoto" | "hibrido";

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
  status: "active" | "paused" | "closed";
  created_at: string;
  closed_at: string | null;
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
  professionals_count: number; // quantos profissionais receberam
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
