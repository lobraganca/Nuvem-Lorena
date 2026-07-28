export type Category =
  | "Viagem"
  | "Trilha"
  | "Praia"
  | "Cachoeira"
  | "Observação de animais"
  | "Restaurante"
  | "Museu"
  | "Parque"
  | "Cidade"
  | "Outro";

export interface Person {
  id: string;
  name: string;
  avatarColor: string;
}

export type AccountType = "turista" | "profissional";

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarPhoto?: string; // data URL
  avatarColor: string;
  isPrivate: boolean;
  accountType?: AccountType;
  ownBusinessId?: string;
}

export interface Message {
  id: string;
  personId: string; // the other party in the conversation
  sender: "me" | "them";
  text: string;
  timestamp: string; // ISO datetime
}

export type BusinessType = "Agência" | "Guia" | "Restaurante" | "Hotel";

export type PlanTier = "Básico" | "Pro" | "Avançado";

export type CancellationPolicy =
  | "flexivel"
  | "moderada"
  | "rigida";

export interface Tour {
  id: string;
  title: string;
  description?: string;
  priceFrom?: number;
  durationHours?: number;
  cancellationPolicy?: CancellationPolicy;
  capacityPerDay?: number; // max travelers per departure date; undefined = not tracked
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  planTier: PlanTier;
  description: string;
  city: string;
  state?: string;
  country: string;
  email: string;
  phone?: string;
  website?: string;
  createdAt: string; // ISO date
  tours?: Tour[];
  /**
   * Cadastur registration number (Ministério do Turismo). Legally required in
   * Brazil for tour agencies, guides and lodging before selling services.
   */
  cadastur?: string;
}

export type BookingStatus = "confirmada" | "cancelada";

export interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  tourId: string;
  tourTitle: string;
  travelDate: string; // ISO date
  travelers: number;
  unitPrice: number;
  totalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  businessPayout: number;
  createdAt: string; // ISO datetime
  reviewed?: boolean;
  status: BookingStatus;
  cancellationPolicy: CancellationPolicy;
  cancelledAt?: string; // ISO datetime
  refundAmount?: number;
}

export interface Review {
  id: string;
  businessId: string;
  bookingId: string;
  tourTitle: string;
  rating: number; // 1-5
  comment: string;
  recommends: boolean;
  authorName: string;
  createdAt: string; // ISO datetime
}

export interface Experience {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lng: number;
  locationName: string;
  city: string;
  state?: string;
  country: string;
  date: string; // ISO date
  photos: string[]; // emoji/placeholder urls
  diary?: string;
  rating?: number; // 1-5
  mood?: string;
  peopleIds: string[];
  agency?: string;
  guide?: string;
  animalsSeen?: string[];
  restaurants?: string[];
  expenses?: number;
  notes?: string;
}
