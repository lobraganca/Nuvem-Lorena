export type SubscriptionType = "verification" | "boost";
export type SubscriptionStatus = "pending" | "authorized" | "active" | "paused" | "cancelled";

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
  created_at: string;
}

export interface Review {
  id: string;
  professional_id: string;
  user_id: string;
  rating: number; // 1-5
  comment: string;
  reply: string | null; // resposta do dono do anúncio
  replied_at: string | null;
  created_at: string;
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
export const DEFAULT_CITY = "Itabirito";

export const CITIES = [DEFAULT_CITY, "Ouro Preto", "Belo Horizonte", "Congonhas"] as const;
