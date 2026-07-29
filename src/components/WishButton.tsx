import { useAvena } from "../store/AvenaContext";
import { isTourWished } from "../lib/wishlist";
import { useT } from "../i18n";
import type { Business, Tour } from "../types";
import { newId } from "../lib/ids";

/** Puts a published tour on the traveller's want-to-do list, or takes it off. */
export function WishButton({ business, tour }: { business: Business; tour: Tour }) {
  const { wishlist, addWish, removeWish } = useAvena();
  const t = useT();

  const existing = wishlist.find((w) => w.tourId === tour.id && !w.doneAt);
  const wished = isTourWished(wishlist, tour.id);

  function toggle() {
    if (existing) {
      removeWish(existing.id);
      return;
    }
    addWish({
      id: newId(),
      title: tour.title,
      city: business.city,
      state: business.state,
      tourId: tour.id,
      businessId: business.id,
      businessName: business.name,
      priceFrom: tour.priceFrom,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <button
      type="button"
      className={`btn-outline wish-btn ${wished ? "wish-btn-on" : ""}`}
      onClick={toggle}
      aria-pressed={wished}
    >
      {t(wished ? "wish.saved" : "wish.add")}
    </button>
  );
}
