export type SubscriptionType = "verification" | "boost";
export type SubscriptionStatus = "pending" | "authorized" | "active" | "paused" | "cancelled";

export interface Profile {
  id: string; // = auth.users.id
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Professional {
  id: string;
  owner_id: string; // profiles.id do dono do anúncio
  name: string;
  category: string;
  city: string;
  bio: string;
  phone: string; // whatsapp
  verified: boolean;
  verified_until: string | null;
  boosted: boolean;
  boosted_until: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  professional_id: string;
  user_id: string;
  rating: number; // 1-5
  comment: string;
  created_at: string;
}

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
