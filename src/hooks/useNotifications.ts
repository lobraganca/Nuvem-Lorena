import { useMemo } from "react";
import { useAvena } from "../store/AvenaContext";
import { buildNotifications } from "../lib/notifications";

export function useNotifications() {
  const { bookings, experiences, businesses, dismissedNotifications, waitlist, user } =
    useAvena();

  return useMemo(() => {
    const businessCityById = new Map(businesses.map((b) => [b.id, b.city]));
    const toursById = new Map(
      businesses.flatMap((b) => (b.tours ?? []).map((t) => [t.id, t] as const))
    );
    return buildNotifications(
      bookings,
      experiences,
      businessCityById,
      dismissedNotifications,
      waitlist,
      toursById,
      user.accountType === "profissional" ? user.ownBusinessId : undefined
    );
  }, [bookings, experiences, businesses, dismissedNotifications, waitlist, user]);
}
