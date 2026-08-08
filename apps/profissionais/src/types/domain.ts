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
  category: string;
  city: string;
  bio: string;
  phone: string; // whatsapp
  entity_type: EntityType; // "pf" = profissional autônomo, "pj" = empresa
  document: string | null; // CPF (pf) ou CNPJ (pj) do anunciante
  company_name: string | null; // razão social/nome fantasia, só relevante para pj
  photo_url: string | null; // foto de rosto (pf) ou logo (pj)
  responsible_name: string | null; // nome do responsável pela empresa, obrigatório só para pj
  verified: boolean;
  verified_until: string | null;
  boosted: boolean;
  boosted_until: string | null;
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
  category: string;
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

export const CATEGORIES = [
  "Encanador",
  "Eletricista",
  "Pedreiro",
  "Diarista",
  "Pintor",
  "Marceneiro",
  "Jardineiro",
  "Chaveiro",
  "Técnico em informática",
  "Manicure",
  "Cabeleireiro",
  "Personal trainer",
  "Professor particular",
  "Fotógrafo",
  "Outros",
] as const;

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

/** Pacotes de créditos disponíveis para compra no modo "pagar por contato". */
export const CREDIT_PACKS = [10, 25, 50] as const;

export const DEFAULT_CITY = "Itabirito";

export const CITIES = [DEFAULT_CITY, "Ouro Preto", "Belo Horizonte", "Congonhas"] as const;
