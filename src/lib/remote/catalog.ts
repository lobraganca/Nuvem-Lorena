import { supabase } from "../supabase";
import type { Booking, Business, Review, Tour } from "../../types";
import {
  bookingParaLinha,
  businessParaLinha,
  linhaParaBooking,
  linhaParaBusiness,
  linhaParaReview,
  linhaParaTour,
  reviewParaLinha,
  tourParaLinha,
} from "./mappers";

/**
 * A vitrine e as reservas, no servidor.
 *
 * É aqui que o Avena deixa de ser uma demonstração. Enquanto os dados moravam
 * no navegador, a reserva que a viajante fazia no celular dela não existia em
 * lugar nenhum além daquele aparelho: a agência nunca ficava sabendo, e a
 * única forma de "combinar" era a viajante ligar por fora — que é exatamente o
 * que a plataforma existe para não precisar acontecer.
 *
 * Nada aqui decide quem pode ver o quê. Quem decide é o Postgres, pelas
 * políticas em supabase/migrations/0002_seguranca.sql. Uma consulta daqui que
 * peça a reserva alheia volta vazia — não porque este arquivo filtrou, mas
 * porque o banco não entregou. É a diferença entre uma tranca e um pedido de
 * licença.
 */

/** O que veio do servidor numa leitura só. */
export interface Catalogo {
  businesses: Business[];
  bookings: Booking[];
  reviews: Review[];
}

/**
 * Erro de leitura vira lista vazia e um aviso no console, nunca uma tela
 * quebrada: um passeio que não carregou é uma vitrine mais pobre, e uma
 * exceção não tratada é um app que não abre.
 */
function aviso(onde: string, erro: unknown): void {
  console.warn(`[avena] falha ao ${onde}:`, erro);
}

export async function pullCatalogo(): Promise<Catalogo | null> {
  const db = supabase();
  if (!db) return null;

  const [empresas, passeios, reservas, avaliacoes] = await Promise.all([
    db.from("businesses").select("*"),
    db.from("tours").select("*"),
    db.from("bookings").select("*").order("created_at", { ascending: false }),
    db.from("reviews").select("*").order("created_at", { ascending: false }),
  ]);

  if (empresas.error) {
    aviso("ler as empresas", empresas.error);
    return null;
  }
  if (passeios.error) aviso("ler os passeios", passeios.error);
  if (reservas.error) aviso("ler as reservas", reservas.error);
  if (avaliacoes.error) aviso("ler as avaliações", avaliacoes.error);

  // Os passeios chegam soltos e vão para dentro da empresa, que é como as
  // telas os pedem. Um passo só, num mapa, em vez de varrer a lista inteira
  // uma vez por empresa.
  const porEmpresa = new Map<string, Tour[]>();
  for (const linha of passeios.data ?? []) {
    const id = String((linha as Record<string, unknown>).business_id);
    const lista = porEmpresa.get(id) ?? [];
    lista.push(linhaParaTour(linha as Record<string, unknown>));
    porEmpresa.set(id, lista);
  }

  return {
    businesses: (empresas.data ?? []).map((linha) =>
      linhaParaBusiness(
        linha as Record<string, unknown>,
        porEmpresa.get(String((linha as Record<string, unknown>).id)) ?? [],
      ),
    ),
    bookings: (reservas.data ?? []).map((linha) =>
      linhaParaBooking(linha as Record<string, unknown>),
    ),
    // O nome de quem avaliou vem do perfil, e o perfil pode ser privado. Até
    // buscarmos os perfis, "Viajante" — melhor do que inventar um nome.
    reviews: (avaliacoes.data ?? []).map((linha) =>
      linhaParaReview(linha as Record<string, unknown>, "Viajante"),
    ),
  };
}

/** O id de quem está logado, ou null. Toda gravação precisa dele. */
async function meuId(): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}

export async function pushBusiness(b: Business): Promise<void> {
  const db = supabase();
  const dono = await meuId();
  if (!db || !dono) return;
  const { error } = await db
    .from("businesses")
    .upsert(businessParaLinha(b, dono));
  if (error) aviso("salvar a empresa", error);
}

/**
 * Atualiza uma empresa sem tocar no dono.
 *
 * Deliberadamente não manda `owner_id`: quem edita nem sempre é quem criou —
 * a administradora suspende empresa alheia — e reescrever o dono a cada edição
 * transferiria a empresa para quem mexeu por último.
 */
export async function pushBusinessPatch(
  businessId: string,
  patch: Partial<Business>,
): Promise<void> {
  const db = supabase();
  if (!db) return;
  const completo = businessParaLinha(
    { ...patch, id: businessId } as Business,
    "",
  );
  const parcial: Record<string, unknown> = {};
  const traduz: Record<string, string> = {
    name: "name",
    type: "type",
    planTier: "plan_tier",
    description: "description",
    city: "city",
    state: "state",
    country: "country",
    email: "email",
    phone: "phone",
    website: "website",
    cadastur: "cadastur",
    address: "address",
    lat: "lat",
    lng: "lng",
    meetingPoint: "meeting_point",
    status: "status",
    verified: "verified",
    claimStatus: "claim_status",
    lastSeenAt: "last_seen_at",
  };
  for (const chave of Object.keys(patch)) {
    const coluna = traduz[chave];
    if (coluna) parcial[coluna] = completo[coluna];
  }
  if (patch.mercadoPago) {
    parcial.mercado_pago_connected = patch.mercadoPago.connected;
    parcial.mercado_pago_label = patch.mercadoPago.accountLabel ?? null;
    parcial.mercado_pago_connected_at = patch.mercadoPago.connectedAt ?? null;
  }
  if (Object.keys(parcial).length === 0) return;

  const { error } = await db
    .from("businesses")
    .update(parcial)
    .eq("id", businessId);
  if (error) aviso("atualizar a empresa", error);
}

export async function pushTour(businessId: string, t: Tour): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { error } = await db.from("tours").upsert(tourParaLinha(businessId, t));
  if (error) aviso("salvar o passeio", error);
}

export async function deleteTour(tourId: string): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { error } = await db.from("tours").delete().eq("id", tourId);
  if (error) aviso("apagar o passeio", error);
}

export async function pushBooking(b: Booking): Promise<void> {
  const db = supabase();
  const viajante = await meuId();
  if (!db || !viajante) return;
  const { error } = await db
    .from("bookings")
    .upsert(bookingParaLinha(b, viajante));
  if (error) aviso("salvar a reserva", error);
}

/**
 * Muda o estado de uma reserva.
 *
 * Só os campos do estado, nunca o preço: uma reserva confirmada não pode mudar
 * de valor depois, e a forma mais barata de garantir isso é não ter como.
 */
export async function pushBookingStatus(
  bookingId: string,
  patch: Partial<
    Pick<
      Booking,
      "status" | "cancelledAt" | "refundAmount" | "declineReason" | "reviewed"
    >
  >,
): Promise<void> {
  const db = supabase();
  if (!db) return;
  const linha: Record<string, unknown> = {};
  if (patch.status !== undefined) linha.status = patch.status;
  if (patch.cancelledAt !== undefined) linha.cancelled_at = patch.cancelledAt;
  if (patch.refundAmount !== undefined)
    linha.refund_amount = patch.refundAmount;
  if (patch.declineReason !== undefined)
    linha.decline_reason = patch.declineReason;
  if (patch.reviewed !== undefined) linha.reviewed = patch.reviewed;
  if (Object.keys(linha).length === 0) return;

  const { error } = await db.from("bookings").update(linha).eq("id", bookingId);
  if (error) aviso("atualizar a reserva", error);
}

export async function pushReview(r: Review): Promise<void> {
  const db = supabase();
  const autor = await meuId();
  if (!db || !autor) return;
  const { error } = await db.from("reviews").insert(reviewParaLinha(r, autor));
  if (error) aviso("salvar a avaliação", error);
}

export async function pushReviewReply(
  reviewId: string,
  reply: string,
): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { error } = await db
    .from("reviews")
    .update({ reply, replied_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) aviso("responder a avaliação", error);
}
