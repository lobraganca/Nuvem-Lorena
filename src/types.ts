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
  /** Ids of travelers this account follows. */
  following?: string[];
  /** Follow requests sent to private profiles, still waiting for an answer. */
  followRequests?: string[];
  /**
   * When each conversation was last opened, keyed by thread. Anything the other
   * side sent after that shows as unread on the tab bar.
   */
  threadReads?: Record<string, string>;
}

/**
 * Another traveler on the platform.
 *
 * Until the backend exists these come from seed data, which is why the feed
 * says so out loud instead of pretending there is a live community.
 */
export interface Traveler {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatarColor: string;
  isPrivate: boolean;
  homeCity: string;
  homeState: string;
  /** Ids of travelers this profile follows back, used for "follows you". */
  follows?: string[];
}

/**
 * Where a banner can appear. Fixed slots rather than free placement, so a
 * banner can never land in the middle of a checkout or a legal notice.
 */
export type BannerPlacement =
  | "home-top"
  | "destination-top"
  | "feed-top"
  | "bookings-top"
  | "wishlist-top";

export type BannerKind = "institucional" | "publicidade";

export interface Banner {
  id: string;
  placement: BannerPlacement;
  /**
   * Institutional banners are Avena's own message; advertising is a third
   * party's and is labelled as such, which CDC art. 36 requires.
   */
  kind: BannerKind;
  title: string;
  text: string;
  /** Optional image, stored like every other photo: a downscaled data URL. */
  image?: string;
  linkUrl?: string;
  linkLabel?: string;
  active: boolean;
  startsAt?: string; // ISO date
  endsAt?: string; // ISO date
  /** Set for the built-in responsible-tourism banner, whose text is translated. */
  translationKey?: "responsible";
}

export type ActivityKind = "memoria" | "reserva";

/** Something a followed traveler did, shown in the feed. */
export interface TravelerActivity {
  id: string;
  travelerId: string;
  kind: ActivityKind;
  title: string;
  place: string;
  city: string;
  state?: string;
  date: string; // ISO date
  category?: Category;
  businessId?: string;
  businessName?: string;
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

export type BusinessType =
  | "Agência"
  | "Guia"
  | "Experiência"
  | "Temporada"
  | "Restaurante"
  | "Hotel";

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

/**
 * What the price is counted in.
 *
 * A boat trip is priced per person; a house is priced per night, no matter how
 * many people sleep in it. Getting this wrong is not a rounding error — it
 * multiplies a rental by the number of guests.
 */
export type PricingUnit = "pessoa" | "diaria";

export interface Tour {
  id: string;
  title: string;
  /** Defaults to "pessoa" when absent, which is what every existing tour is. */
  pricingUnit?: PricingUnit;
  /** Only for a rental: how many people the place sleeps. */
  maxGuests?: number;
  /** Only for a rental: the shortest stay accepted. */
  minNights?: number;
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
  /**
   * O que a pessoa precisa saber antes de reservar, e que hoje ela pergunta
   * por mensagem — quando pergunta. Um passeio de R$ 220 sem estas respostas
   * perde para um de R$ 260 que as tem.
   */
  included?: string;
  bring?: string;
  /** "08:00", ou várias: "08:00 e 14:00". Texto, porque a realidade varia. */
  departureTimes?: string;
  languages?: string;
  /** Quantas pessoas vão juntas. Diferente de capacidade por dia. */
  groupSize?: number;
  /** Datas fechadas pelo dono, "AAAA-MM-DD". Ver lib/calendar.ts. */
  blockedDates?: string[];
  /** Dias da semana em que não há saída. Domingo é 0. */
  closedWeekdays?: number[];
}

/** Set by the Avena admin; suspended businesses disappear from public listings. */
export type BusinessStatus = "ativa" | "suspensa";

/** Who is legally responsible for the service: a company or a person. */
export type LegalKind = "juridica" | "fisica";

/**
 * What a payment provider needs before it can pay anyone.
 *
 * These are the fields Mercado Pago (or any acquirer) asks for when opening a
 * receiving account, and the same ones the Receita Federal ties an invoice to.
 * Collected once, on the partner site, and never on the traveller's phone.
 */
export interface LegalDetails {
  kind: LegalKind;
  /** Company name on the CNPJ card, or the person's full name. */
  legalName: string;
  /** CNPJ for a company, CPF for a sole trader. */
  document: string;
  /** Optional for most tourism services. */
  stateRegistration?: string;
  tradeName?: string;
  cep: string;
  address: string;
  addressExtra?: string;
  district: string;
  city: string;
  state: string;
  /** Who signs for the company. For a person, themselves. */
  representative: string;
  representativeCpf: string;
  businessEmail: string;
  businessPhone: string;
}

export interface Business {
  id: string;
  /** Filled on the partner site; absent for profiles imported by the team. */
  legal?: LegalDetails;
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
  /**
   * Street address, public, for the traveller to find the place. Separate from
   * the address in `legal`, which belongs to whoever answers for the company
   * and is not shown to anyone.
   */
  address?: string;
  /** Exact spot on the map. Without it a route is a guess at the address. */
  lat?: number;
  lng?: number;
  /** "Em frente ao quiosque 3", "no portão do parque" — said in words. */
  meetingPoint?: string;
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
  /**
   * Whether this agency connected its own Mercado Pago account. Without it
   * there is nowhere to send the money, so the tour cannot be sold in-app.
   */
  mercadoPago?: MercadoPagoLink;
  /**
   * Profiles created by the Avena team to seed a city start unclaimed. The
   * traveller is told so, because presenting them as signed-up partners would
   * be a lie the agency never agreed to.
   */
  claimStatus?: ClaimStatus;
  /**
   * Last time this agency actually used the app. Presence is derived from it,
   * never set by hand, so an "online" light cannot be left on while nobody is
   * there.
   */
  lastSeenAt?: string; // ISO datetime
}

export type ClaimStatus = "reivindicada" | "nao-reivindicada";

export interface MercadoPagoLink {
  connected: boolean;
  connectedAt?: string; // ISO datetime
  /** Shown back to the agency so it can confirm it linked the right account. */
  accountLabel?: string;
}

/**
 * A paid promotion: the one thing a business pays Avena for.
 *
 * See `lib/ads.ts` for what is being bought and what it costs.
 */
export interface Boost {
  id: string;
  businessId: string;
  businessName: string;
  tourId: string;
  tourTitle: string;
  /** Where it shows. Absent on the ones created before there were placements. */
  placement?: "cidade" | "inicio";
  /** The city the ad was bought for, copied so it survives the business moving. */
  city?: string;
  days: number;
  pricePaid: number;
  startsAt: string; // ISO datetime
  endsAt: string; // ISO datetime
  /**
   * When the ad was paid for. Until it is set the ad exists but does not show
   * — contracting is not the same as paying, and only one of them buys a place
   * ahead of everyone who did not pay.
   */
  paidAt?: string; // ISO datetime
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

/**
 * Something the traveller wants to do.
 *
 * The map holds where you have been; this holds where you want to go. It takes
 * two kinds of entry: a tour published on Avena, and a plain wish like "see the
 * Pantanal" — because people want to go to places that have no partner here
 * yet, and refusing to record that would throw away the most useful signal the
 * platform can collect about where to prospect next.
 */
/**
 * A tour the traveller marked as "quero fazer". It always points at a tour
 * published by a registered business — there is no free-form wish.
 */
export interface WishlistItem {
  id: string;
  tourId: string;
  businessId: string;
  /** Copied from the tour so the list still reads if the tour is taken down. */
  title: string;
  businessName: string;
  city?: string;
  state?: string;
  priceFrom?: number;
  createdAt: string; // ISO datetime
  /** Set when the traveller marks it as done. */
  doneAt?: string;
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
  travelDate: string; // ISO date — for a rental, the check-in
  /** Check-out. Only for a stay priced per night. */
  checkOut?: string; // ISO date
  /** Nights between check-in and check-out. Absent for a per-person booking. */
  nights?: number;
  /** How the price was counted, copied so the receipt still explains itself. */
  pricingUnit?: PricingUnit;
  travelers: number;
  participants: Participant[];
  unitPrice: number;
  /** Price of the tour times the travellers, before Avena's fee. */
  subtotal: number;
  /** Avena's service fee, paid by the traveller on top of the subtotal. */
  serviceFeeRate: number;
  serviceFee: number;
  /** What the traveller pays: subtotal plus the fee. */
  totalPrice: number;
  /** What the business receives — the whole advertised price. */
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
