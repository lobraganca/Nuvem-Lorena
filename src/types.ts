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
  /**
   * Version of the Terms/Privacy Policy the user accepted, and when. A bump in
   * LEGAL_VERSION invalidates the previous acceptance and forces a new one
   * before the next transaction.
   */
  acceptedLegalVersion?: string;
  acceptedLegalAt?: string; // ISO datetime
}

/** A conversation thread is with either a person or a business, never both. */
export interface Message {
  id: string;
  personId?: string;
  businessId?: string;
  sender: "me" | "them";
  text: string;
  timestamp: string; // ISO datetime
}

export interface MessageThread {
  personId?: string;
  businessId?: string;
}

export type BusinessType = "Agência" | "Guia" | "Restaurante" | "Hotel";

export type PlanTier = "Básico" | "Pro" | "Avançado";

export type CancellationPolicy =
  | "flexivel"
  | "moderada"
  | "rigida";

export type Difficulty = "Leve" | "Moderada" | "Pesada";

export type AccessibilityTag =
  | "Cadeirante"
  | "Mobilidade reduzida"
  | "Crianças"
  | "Idosos"
  | "Não exige natação";

export interface Tour {
  id: string;
  title: string;
  /** Months (1-12) when this tour is at its best, e.g. whale season. */
  seasonMonths?: number[];
  difficulty?: Difficulty;
  accessibility?: AccessibilityTag[];
  description?: string;
  priceFrom?: number;
  durationHours?: number;
  cancellationPolicy?: CancellationPolicy;
  capacityPerDay?: number; // max travelers per departure date; undefined = not tracked
  /** Photos of the tour itself. Nobody books a boat trip without seeing the water. */
  photos?: string[];
}

/** Set by the Avena admin; suspended businesses disappear from public listings. */
export type BusinessStatus = "ativa" | "suspensa";

export interface Business {
  id: string;
  status?: BusinessStatus;
  /** Verified by the admin after checking the Cadastur registration. */
  verified?: boolean;
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

/** A paid promotion that lifts a tour onto the traveler's first screen. */
export interface Boost {
  id: string;
  businessId: string;
  businessName: string;
  tourId: string;
  tourTitle: string;
  days: number;
  pricePaid: number;
  startsAt: string; // ISO datetime
  endsAt: string; // ISO datetime
}

export type DocumentType = "CPF" | "RG" | "Passaporte";

/**
 * Each person going on the tour. Agencies need the full list by law for
 * boat manifests, park entry and insurance — not just a headcount.
 */
export interface Participant {
  name: string;
  documentType: DocumentType;
  document: string;
  birthDate?: string; // ISO date
}

/** Someone waiting for a spot to open on a sold-out date. */
export interface WaitlistEntry {
  id: string;
  tourId: string;
  tourTitle: string;
  businessId: string;
  businessName: string;
  date: string; // ISO date
  people: number;
  createdAt: string;
  notifiedAt?: string;
}

/**
 * A booking is only "confirmada" after the payment clears. Until then the seat
 * is held but not sold, which is what the agency's manifest has to reflect.
 */
export type BookingStatus =
  | "aguardando-pagamento"
  | "confirmada"
  | "expirada"
  | "cancelada";

export type PaymentMethod = "pix" | "cartao";

export interface Payment {
  method: PaymentMethod;
  paidAt: string; // ISO datetime
  /** Reference the traveller can quote when contacting support. */
  reference: string;
}

export interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  tourId: string;
  tourTitle: string;
  travelDate: string; // ISO date
  travelers: number;
  participants: Participant[];
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
  /** Set once the payment clears; absent while the booking is awaiting payment. */
  payment?: Payment;
  /** Deadline for paying. After it passes the seat goes back to the pool. */
  paymentDueAt?: string; // ISO datetime
}

export type SupportTicketStatus = "aberto" | "respondido" | "resolvido";

export type SupportTicketSubject =
  | "Problema com uma reserva"
  | "Cobrança ou reembolso"
  | "Agência ou guia não compareceu"
  | "Denúncia de conteúdo"
  | "Minha conta e meus dados"
  | "Outro assunto";

/**
 * A traveller's channel to Avena itself, separate from the direct chat with the
 * agency — because the complaint is often about the agency.
 */
export interface SupportTicket {
  id: string;
  subject: SupportTicketSubject;
  message: string;
  bookingId?: string;
  createdAt: string; // ISO datetime
  status: SupportTicketStatus;
  reply?: string;
  repliedAt?: string;
  /** Short code the person can quote, e.g. AV-4F2C. */
  protocol: string;
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
  /** People invited to add their own photos to this memory. */
  invitedPersonIds?: string[];
  /** Booking this memory came from, when it was created from a purchase. */
  bookingId?: string;
  agency?: string;
  guide?: string;
  animalsSeen?: string[];
  restaurants?: string[];
  expenses?: number;
  notes?: string;
}
