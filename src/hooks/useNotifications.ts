import { useMemo } from "react";
import { useAvena } from "../store/AvenaContext";
import { buildNotifications } from "../lib/notifications";

export function useNotifications() {
  const { bookings, experiences, businesses, dismissedNotifications } = useAvena();

  return useMemo(() => {
    const businessCityById = new Map(businesses.map((b) => [b.id, b.city]));
    return buildNotifications(
      bookings,
      experiences,
      businessCityById,
      dismissedNotifications
    );
  }, [bookings, experiences, businesses, dismissedNotifications]);
}
