import type { Booking, Experience, Tour, WaitlistEntry } from "../types";
import { availabilityFor } from "./availability";

export type NotificationKind =
  | "vaga-liberada"
  | "passeio-hoje"
  | "avaliar"
  | "registrar-memoria"
  | "reserva-recebida";

export interface AvenaNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actionLabel: string;
  actionTo: string;
  date: string; // ISO date the notification refers to
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A booking counts as "already lived" once its travel date is in the past.
 * Cancelled bookings never generate follow-ups.
 */
function isFinished(booking: Booking, today: string): boolean {
  return booking.status === "confirmada" && booking.travelDate < today;
}

/**
 * We consider the trip already turned into a memory when an experience was
 * registered in the same city within a few days of the tour.
 */
function hasMatchingExperience(
  booking: Booking,
  experiences: Experience[],
  businessCityById: Map<string, string>
): boolean {
  const city = businessCityById.get(booking.businessId);
  if (!city) return false;

  const tourTime = new Date(booking.travelDate).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  return experiences.some((exp) => {
    if (exp.city !== city) return false;
    const diff = Math.abs(new Date(exp.date).getTime() - tourTime);
    return diff <= threeDays;
  });
}

export function buildNotifications(
  bookings: Booking[],
  experiences: Experience[],
  businessCityById: Map<string, string>,
  dismissed: string[] = [],
  waitlist: WaitlistEntry[] = [],
  toursById: Map<string, Tour> = new Map(),
  /** A empresa de quem está olhando, quando é uma conta profissional. */
  ownBusinessId?: string
): AvenaNotification[] {
  const today = todayIso();
  const dismissedSet = new Set(dismissed);
  const notifications: AvenaNotification[] = [];

  // Do lado de quem recebe: reserva nova, e a que está para acontecer.
  //
  // Faltava inteiro — a agência só descobria uma reserva entrando no painel,
  // e uma reserva que ninguém viu é uma pessoa esperando no cais.
  if (ownBusinessId) {
    for (const booking of bookings) {
      if (booking.businessId !== ownBusinessId) continue;
      if (booking.status === "cancelada" || booking.status === "expirada") continue;

      if (booking.status === "confirmada" && booking.travelDate >= today) {
        notifications.push({
          id: `recebida-${booking.id}`,
          kind: "reserva-recebida",
          title:
            booking.travelDate === today
              ? "Você recebe gente hoje"
              : "Nova reserva confirmada",
          body: `${booking.tourTitle} · ${new Date(
            booking.travelDate
          ).toLocaleDateString("pt-BR")} · ${booking.travelers} ${
            booking.travelers === 1 ? "pessoa" : "pessoas"
          }`,
          actionLabel: "Ver no painel",
          actionTo: "/professional",
          date: booking.travelDate,
        });
      }

      if (booking.status === "aguardando-pagamento") {
        notifications.push({
          id: `pendente-${booking.id}`,
          kind: "reserva-recebida",
          title: "Vaga reservada, pagamento pendente",
          body: `${booking.tourTitle}. Não conte com esta vaga até a confirmação.`,
          actionLabel: "Ver no painel",
          actionTo: "/professional",
          date: booking.travelDate,
        });
      }
    }
    return notifications.filter((n) => !dismissedSet.has(n.id));
  }

  for (const booking of bookings) {
    if (booking.status !== "confirmada") continue;

    if (booking.travelDate === today) {
      notifications.push({
        id: `hoje-${booking.id}`,
        kind: "passeio-hoje",
        title: "Seu passeio é hoje",
        body: `${booking.tourTitle} com ${booking.businessName}. Boa viagem!`,
        actionLabel: "Ver reserva",
        actionTo: "/bookings",
        date: booking.travelDate,
      });
      continue;
    }

    if (!isFinished(booking, today)) continue;

    if (!booking.reviewed) {
      notifications.push({
        id: `avaliar-${booking.id}`,
        kind: "avaliar",
        title: "Como foi seu passeio?",
        body: `Avalie ${booking.businessName} e ajude outros viajantes a escolherem bem.`,
        actionLabel: "Avaliar agora",
        actionTo: "/bookings",
        date: booking.travelDate,
      });
    }

    if (!hasMatchingExperience(booking, experiences, businessCityById)) {
      notifications.push({
        id: `memoria-${booking.id}`,
        kind: "registrar-memoria",
        title: "Guarde essa memória",
        body: `Você viveu ${booking.tourTitle}. Registre no seu mapa afetivo antes que os detalhes se percam.`,
        actionLabel: "Registrar experiência",
        actionTo: `/experience/new?booking=${booking.id}`,
        date: booking.travelDate,
      });
    }
  }

  // A cancellation frees seats, so anyone waiting on that date is told.
  for (const entry of waitlist) {
    if (entry.date < today) continue;
    const tour = toursById.get(entry.tourId);
    if (!tour) continue;

    const availability = availabilityFor(tour, bookings, entry.date);
    if (availability.tracked && availability.remaining >= entry.people) {
      notifications.push({
        id: `vaga-${entry.id}`,
        kind: "vaga-liberada",
        title: "Abriu vaga no passeio que você queria",
        body: `${entry.tourTitle} com ${entry.businessName} tem ${availability.remaining} ${availability.remaining === 1 ? "vaga" : "vagas"} em ${new Date(entry.date).toLocaleDateString("pt-BR")}.`,
        actionLabel: "Reservar agora",
        actionTo: `/business/${entry.businessId}`,
        date: entry.date,
      });
    }
  }

  return notifications
    .filter((n) => !dismissedSet.has(n.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
