import type { Booking, Business, Review, Tour } from "../../types";

/**
 * Tradutores entre o formato do app e o do banco.
 *
 * São dois vocabulários diferentes de propósito. O app fala em `priceFrom` e
 * guarda os passeios dentro da empresa, porque é assim que a tela precisa
 * deles. O Postgres fala em `price_from` e guarda passeio em tabela separada,
 * porque é assim que se pergunta "quais passeios têm vaga no sábado" sem ler
 * todas as empresas do Brasil.
 *
 * Este arquivo é a fronteira entre os dois. Ela existe para que o resto do app
 * continue sem saber que existe banco: nenhuma tela precisa aprender
 * snake_case, e no dia em que uma coluna mudar de nome, muda aqui.
 *
 * Regra que se repete em toda linha: campo ausente vira `null` na ida e
 * `undefined` na volta. `null` e `undefined` são a mesma ausência para quem
 * lê a tela, mas o Postgres só entende o primeiro e o TypeScript só entende o
 * segundo — misturar os dois enche o app de "null" escrito na tela.
 */

/** `undefined` → `null`, para o Postgres entender "não preenchido". */
function ou<T>(valor: T | undefined): T | null {
  return valor === undefined ? null : valor;
}

/** `null` → `undefined`, para a tela não escrever "null" no lugar do vazio. */
function talvez<T>(valor: T | null | undefined): T | undefined {
  return valor === null || valor === undefined ? undefined : valor;
}

/**
 * Tira da linha as colunas que têm valor padrão no banco e vieram vazias.
 *
 * Isto foi um erro real, pego no teste: o Postgres distingue "não mandei esta
 * coluna" de "mandei vazio". No primeiro caso ele aplica o padrão; no segundo
 * ele obedece, e uma coluna que nunca pode ficar vazia recusa a gravação
 * inteira. Uma agência sem nada preenchido em `claim_status` não era salva.
 *
 * Só as colunas listadas em cada mapa abaixo são tratadas assim. As demais
 * continuam mandando `null` de propósito: é assim que se apaga um site ou um
 * telefone que a agência resolveu tirar do ar — omitir a coluna deixaria o
 * valor antigo lá.
 */
function comPadraoDoBanco(
  linha: Record<string, unknown>,
  colunas: readonly string[],
): Record<string, unknown> {
  const saida = { ...linha };
  for (const c of colunas) if (saida[c] === null) delete saida[c];
  return saida;
}

/** Colunas `not null` com padrão. Espelham 0001_esquema.sql. */
const PADRAO_TOURS = [
  "accessibility",
  "blocked_dates",
  "cancellation_policy",
  "closed_weekdays",
  "high_season_months",
  "paused",
  "photos",
  "pricing_unit",
  "season_months",
] as const;
const PADRAO_BUSINESSES = ["claim_status", "plan_tier", "status"] as const;
const PADRAO_BOOKINGS = ["pricing_unit"] as const;

// ---------------------------------------------------------------------------
// Passeios
// ---------------------------------------------------------------------------

export type LinhaTour = Record<string, unknown>;

export function tourParaLinha(businessId: string, t: Tour): LinhaTour {
  return comPadraoDoBanco(
    {
      id: t.id,
      business_id: businessId,
      title: t.title,
      description: ou(t.description),
      price_from: ou(t.priceFrom),
      duration_hours: ou(t.durationHours),
      difficulty: ou(t.difficulty),
      accessibility: ou(t.accessibility),
      season_months: ou(t.seasonMonths),
      cancellation_policy: ou(t.cancellationPolicy),
      capacity_per_day: ou(t.capacityPerDay),
      photos: ou(t.photos),
      pricing_unit: ou(t.pricingUnit),
      max_guests: ou(t.maxGuests),
      min_nights: ou(t.minNights),
      included: ou(t.included),
      bring: ou(t.bring),
      departure_times: ou(t.departureTimes),
      languages: ou(t.languages),
      group_size: ou(t.groupSize),
      paused: ou(t.paused),
      blocked_dates: ou(t.blockedDates),
      closed_weekdays: ou(t.closedWeekdays),
      weekend_price: ou(t.weekendPrice),
      high_season_price: ou(t.highSeasonPrice),
      high_season_months: ou(t.highSeasonMonths),
    },
    PADRAO_TOURS,
  );
}

export function linhaParaTour(r: LinhaTour): Tour {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    description: talvez(r.description as string | null),
    priceFrom: talvez(numero(r.price_from)),
    durationHours: talvez(numero(r.duration_hours)),
    difficulty: talvez(r.difficulty as Tour["difficulty"]),
    accessibility: talvez(r.accessibility as Tour["accessibility"]),
    seasonMonths: talvez(r.season_months as number[] | null),
    cancellationPolicy: talvez(
      r.cancellation_policy as Tour["cancellationPolicy"],
    ),
    capacityPerDay: talvez(r.capacity_per_day as number | null),
    photos: talvez(r.photos as string[] | null),
    pricingUnit: talvez(r.pricing_unit as Tour["pricingUnit"]),
    maxGuests: talvez(r.max_guests as number | null),
    minNights: talvez(r.min_nights as number | null),
    included: talvez(r.included as string | null),
    bring: talvez(r.bring as string | null),
    departureTimes: talvez(r.departure_times as string | null),
    languages: talvez(r.languages as string | null),
    groupSize: talvez(r.group_size as number | null),
    paused: talvez(r.paused as boolean | null),
    blockedDates: talvez(r.blocked_dates as string[] | null),
    closedWeekdays: talvez(r.closed_weekdays as number[] | null),
    weekendPrice: talvez(numero(r.weekend_price)),
    highSeasonPrice: talvez(numero(r.high_season_price)),
    highSeasonMonths: talvez(r.high_season_months as number[] | null),
  };
}

/**
 * `numeric` do Postgres chega como texto no JavaScript.
 *
 * Não é capricho do driver: `numeric` guarda mais casas do que o número do
 * JavaScript aguenta, então mandar como texto é a única forma de não perder
 * centavo no caminho. Quem esquece disto soma "10.00" com "5.00" e recebe
 * "10.005.00".
 */
function numero(valor: unknown): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export function businessParaLinha(
  b: Business,
  ownerId: string,
): Record<string, unknown> {
  return comPadraoDoBanco(
    {
      id: b.id,
      owner_id: ownerId,
      name: b.name,
      type: b.type,
      plan_tier: b.planTier,
      description: b.description,
      city: b.city,
      state: ou(b.state),
      country: b.country,
      email: b.email,
      phone: ou(b.phone),
      website: ou(b.website),
      cadastur: ou(b.cadastur),
      address: ou(b.address),
      lat: ou(b.lat),
      lng: ou(b.lng),
      meeting_point: ou(b.meetingPoint),
      mercado_pago_connected: b.mercadoPago?.connected ?? false,
      mercado_pago_label: ou(b.mercadoPago?.accountLabel),
      mercado_pago_connected_at: ou(b.mercadoPago?.connectedAt),
      status: b.status ?? "ativa",
      verified: b.verified ?? false,
      claim_status: ou(b.claimStatus),
      last_seen_at: ou(b.lastSeenAt),
      created_at: b.createdAt,
    },
    PADRAO_BUSINESSES,
  );
}

export function linhaParaBusiness(
  r: Record<string, unknown>,
  tours: Tour[],
): Business {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    type: r.type as Business["type"],
    // "Básico" e não "gratuito": os três planos são Básico, Pro e Avançado, e
    // o banco recusa qualquer outro. Um valor inventado aqui atravessaria o
    // app inteiro até a próxima gravação, e só então explodiria.
    planTier: (r.plan_tier ?? "Básico") as Business["planTier"],
    description: String(r.description ?? ""),
    city: String(r.city ?? ""),
    state: talvez(r.state as string | null),
    country: String(r.country ?? "Brasil"),
    email: String(r.email ?? ""),
    phone: talvez(r.phone as string | null),
    website: talvez(r.website as string | null),
    cadastur: talvez(r.cadastur as string | null),
    address: talvez(r.address as string | null),
    lat: talvez(numero(r.lat)),
    lng: talvez(numero(r.lng)),
    meetingPoint: talvez(r.meeting_point as string | null),
    status: talvez(r.status as Business["status"]),
    verified: Boolean(r.verified),
    claimStatus: talvez(r.claim_status as Business["claimStatus"]),
    lastSeenAt: talvez(r.last_seen_at as string | null),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    tours,
    mercadoPago: r.mercado_pago_connected
      ? {
          connected: true,
          accountLabel: talvez(r.mercado_pago_label as string | null),
          connectedAt: talvez(r.mercado_pago_connected_at as string | null),
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

export function bookingParaLinha(
  b: Booking,
  travelerId: string,
): Record<string, unknown> {
  return comPadraoDoBanco(
    {
      id: b.id,
      traveler_id: travelerId,
      business_id: b.businessId,
      tour_id: b.tourId,
      business_name: b.businessName,
      tour_title: b.tourTitle,
      unit_price: b.unitPrice,
      travel_date: b.travelDate,
      check_out: ou(b.checkOut),
      nights: ou(b.nights),
      pricing_unit: ou(b.pricingUnit),
      travelers: b.travelers,
      subtotal: b.subtotal,
      service_fee_rate: b.serviceFeeRate,
      service_fee: b.serviceFee,
      total_price: b.totalPrice,
      business_payout: b.businessPayout,
      status: b.status,
      cancellation_policy: b.cancellationPolicy,
      payment_due_at: ou(b.paymentDueAt),
      cancelled_at: ou(b.cancelledAt),
      refund_amount: ou(b.refundAmount),
      decline_reason: ou(b.declineReason),
      reviewed: b.reviewed ?? false,
      created_at: b.createdAt,
    },
    PADRAO_BOOKINGS,
  );
}

export function linhaParaBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    businessName: String(r.business_name ?? ""),
    tourId: String(r.tour_id ?? ""),
    tourTitle: String(r.tour_title ?? ""),
    travelDate: String(r.travel_date ?? ""),
    checkOut: talvez(r.check_out as string | null),
    nights: talvez(r.nights as number | null),
    pricingUnit: talvez(r.pricing_unit as Booking["pricingUnit"]),
    travelers: Number(r.travelers ?? 1),
    // Os dados dos participantes vivem em tabela própria, com regra de acesso
    // mais apertada: são documentos de pessoas. Quem precisar deles busca lá.
    participants: [],
    unitPrice: numero(r.unit_price) ?? 0,
    subtotal: numero(r.subtotal) ?? 0,
    serviceFeeRate: numero(r.service_fee_rate) ?? 0,
    serviceFee: numero(r.service_fee) ?? 0,
    totalPrice: numero(r.total_price) ?? 0,
    businessPayout: numero(r.business_payout) ?? 0,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    reviewed: Boolean(r.reviewed),
    status: r.status as Booking["status"],
    cancellationPolicy: r.cancellation_policy as Booking["cancellationPolicy"],
    cancelledAt: talvez(r.cancelled_at as string | null),
    refundAmount: talvez(numero(r.refund_amount)),
    declineReason: talvez(r.decline_reason as string | null),
    paymentDueAt: talvez(r.payment_due_at as string | null),
  };
}

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

export function reviewParaLinha(
  r: Review,
  authorId: string,
): Record<string, unknown> {
  return {
    id: r.id,
    booking_id: r.bookingId,
    business_id: r.businessId,
    tour_id: ou(r.tourId),
    author_id: authorId,
    tour_title: r.tourTitle,
    rating: r.rating,
    comment: r.comment,
    recommends: r.recommends,
    reply: ou(r.reply),
    replied_at: ou(r.repliedAt),
    created_at: r.createdAt,
  };
}

export function linhaParaReview(
  r: Record<string, unknown>,
  authorName: string,
): Review {
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    bookingId: String(r.booking_id ?? ""),
    tourId: talvez(r.tour_id as string | null),
    tourTitle: String(r.tour_title ?? ""),
    rating: Number(r.rating ?? 5),
    comment: String(r.comment ?? ""),
    recommends: Boolean(r.recommends),
    authorName,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    reply: talvez(r.reply as string | null),
    repliedAt: talvez(r.replied_at as string | null),
  };
}
