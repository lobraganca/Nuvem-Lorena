import type { Booking, Experience } from "../types";

export type NotificationKind =
  | "passeio-hoje"
  | "avaliar"
  | "registrar-memoria";

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
  dismissed: string[] = []
): AvenaNotification[] {
  const today = todayIso();
  const dismissedSet = new Set(dismissed);
  const notifications: AvenaNotification[] = [];

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
        actionTo: "/experience/new",
        date: booking.travelDate,
      });
    }
  }

  return notifications
    .filter((n) => !dismissedSet.has(n.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
