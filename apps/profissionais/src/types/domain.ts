export type SubscriptionType = "verification" | "boost" | "plus";
export type SubscriptionStatus = "pending" | "authorized" | "active" | "paused" | "cancelled";
export type BillingCycle = "monthly" | "annual";

export type ContactMode = "whatsapp_livre" | "pay_per_lead";

export interface Profile {
  id: string; // = auth.users.id
  full_name: string | null;
  avatar_url: string | null;
  cpf: string | null; // exigido para poder avaliar, ligado à conta Google do login
  created_at: string;
}

export type EntityType = "pf" | "pj";

export interface Professional {
  id: string;
  owner_id: string; // profiles.id do dono do anúncio
  name: string;
  category: string; // categoria principal (destaque no card, usada no patrocínio)
  categories: string[]; // todos os serviços que a pessoa oferece — é o que a busca consulta
  city: string;
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
  reply: string | null; // resposta do dono do anúncio
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
 * Serviços sugeridos no formulário do anúncio.
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

/** Limite do serviço escrito à mão: um ofício, não uma descrição do anúncio. */
export const MAX_CATEGORIA_LEN = 32;

/**
 * Cidade padrão do produto hoje ("Busca Itabirito"). A modelagem já guarda a
 * cidade por profissional em texto livre para permitir expandir para outras
 * cidades sem migração de schema — a busca simplesmente filtra por esse campo.
 */
/** Pacotes de duração do banner de categoria patrocinada, com preço fixo por período. */
export const SPONSORSHIP_PLANS = [
  { days: 7, amount: 29.9 },
  { days: 15, amount: 49.9 },
  { days: 30, amount: 79.9 },
] as const;

/** Teto de serviços por anúncio: quem marca tudo não está dizendo nada. */
export const MAX_CATEGORIES = 5;

/**
 * Etiquetas de atendimento — o "quando" e o "como" do anúncio.
 *
 * O anúncio já diz o que a pessoa faz e onde. O que ele não dizia é
 * exatamente o que quem procura pergunta antes de qualquer outra coisa:
 * atende sábado? dá para hoje? aceita cartão? vai até minha casa? Cada uma
 * dessas perguntas era uma mensagem no WhatsApp que só existia porque o
 * anúncio ficou calado — e boa parte delas morria sem resposta.
 *
 * É uma lista fechada de propósito. Etiqueta escrita à mão vira propaganda
 * ("o melhor da cidade", "preço imbatível"), e aí ninguém mais consegue
 * comparar dois anúncios: se cada um inventa a própria etiqueta, a etiqueta
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
 * Teto de etiquetas por anúncio, igual ao do banco.
 *
 * Oito é generoso de propósito: o limite não está aqui para racionar, está
 * para impedir o anúncio que marca as dezesseis e volta a não informar nada.
 */
export const MAX_ATRIBUTOS = 8;

/** Pacotes de créditos disponíveis para compra no modo "pagar por contato". */
export const CREDIT_PACKS = [10, 25, 50] as const;

export const DEFAULT_CITY = "Itabirito";

export const CITIES = [DEFAULT_CITY, "Ouro Preto", "Belo Horizonte", "Congonhas"] as const;
