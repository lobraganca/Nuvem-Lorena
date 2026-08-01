import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Banner, Booking, Boost, Business, BusinessStatus, Experience, Message, MessageThread, PaymentMethod, Person, Review, SupportTicket, SupportTicketSubject, MercadoPagoLink, Tour, Traveler, TravelerActivity, UserProfile, WaitlistEntry, WishlistItem } from "../types";
import {
  mockBusinesses,
  mockMessages,
  mockPeople,
  mockReviews,
  mockUser,
} from "../data/mockData";
import { mockTravelerActivity, mockTravelers } from "../data/travelers";
import { computeRefund } from "../lib/cancellation";
import { canReview } from "../lib/reviewEligibility";
import { threadKey } from "../lib/messages";
import { readStored, storageAvailable, writeStored } from "../lib/safeStorage";
import { newId } from "../lib/ids";

const STORAGE_KEY = "avena-data-v19";

interface AvenaData {
  experiences: Experience[];
  people: Person[];
  businesses: Business[];
  user: UserProfile;
  messages: Message[];
  bookings: Booking[];
  reviews: Review[];
  boosts: Boost[];
  waitlist: WaitlistEntry[];
  dismissedNotifications: string[];
  supportTickets: SupportTicket[];
  travelers: Traveler[];
  travelerActivity: TravelerActivity[];
  banners: Banner[];
  wishlist: WishlistItem[];
}

interface AvenaContextValue extends AvenaData {
  addExperience: (exp: Experience) => void;
  updateExperience: (exp: Experience) => void;
  deleteExperience: (id: string) => void;
  addPerson: (person: Person) => void;
  /** Finds a person by name or creates one, returning the id. */
  ensurePerson: (name: string) => string;
  inviteToExperience: (experienceId: string, personId: string) => void;
  addBusiness: (business: Business) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  sendMessage: (thread: MessageThread, text: string) => void;
  markThreadRead: (thread: MessageThread) => void;
  addBooking: (booking: Booking) => void;
  /** Edits fields of a business the person owns. */
  updateBusiness: (businessId: string, patch: Partial<Business>) => void;
  addTourToBusiness: (businessId: string, tour: Tour) => void;
  updateTour: (businessId: string, tour: Tour) => void;
  removeTour: (businessId: string, tourId: string) => void;
  addReview: (review: Review) => void;
  /** A resposta pública da empresa a uma avaliação. */
  replyToReview: (reviewId: string, reply: string) => void;
  cancelBooking: (bookingId: string) => void;
  /**
   * A empresa recusa uma reserva que não vai conseguir atender.
   * Diferente de cancelar: o reembolso é sempre integral.
   */
  declineBooking: (bookingId: string, reason: string) => void;
  addBoost: (boost: Boost) => void;
  joinWaitlist: (entry: WaitlistEntry) => void;
  leaveWaitlist: (entryId: string) => void;
  endBoost: (boostId: string) => void;
  setBusinessStatus: (businessId: string, status: BusinessStatus) => void;
  setBusinessVerified: (businessId: string, verified: boolean) => void;
  removeReview: (reviewId: string) => void;
  dismissNotification: (notificationId: string) => void;
  payBooking: (bookingId: string, method: PaymentMethod) => void;
  openTicket: (input: {
    subject: SupportTicketSubject;
    message: string;
    bookingId?: string;
  }) => SupportTicket;
  replyTicket: (ticketId: string, reply: string) => void;
  resolveTicket: (ticketId: string) => void;
  /** Everything the person has, as a JSON string they can save somewhere safe. */
  exportData: () => string;
  /** Replaces everything with a previously exported backup. */
  importData: (json: string) => void;
  /**
   * True when a save failed because the 5 MB quota filled up, almost always
   * with photos. Until it clears, changes are only in memory.
   */
  storageFull: boolean;
  /**
   * True when the browser refuses storage altogether — a page opened from a
   * file, private browsing, storage blocked in the settings. Nothing will
   * survive closing the tab, and the app says so rather than pretending.
   */
  storageBlocked: boolean;
  /** Follows a public profile, or sends a request to a private one. */
  followTraveler: (travelerId: string) => void;
  unfollowTraveler: (travelerId: string) => void;
  setMercadoPagoLink: (businessId: string, link: MercadoPagoLink) => void;
  /** Records that the agency is using the app right now. */
  touchBusinessPresence: (businessId: string) => void;
  addWish: (wish: WishlistItem) => void;
  removeWish: (wishId: string) => void;
  /** Marks a wish as done, or undoes that. */
  toggleWishDone: (wishId: string) => void;
  saveBanner: (banner: Banner) => void;
  removeBanner: (bannerId: string) => void;
}

const AvenaContext = createContext<AvenaContextValue | null>(null);

function defaults(): AvenaData {
  return {
    // The catalogue starts full and the person's own map starts empty. Seeded
    // memories showed up under "your latest memories" as if they were theirs,
    // which is both confusing and a small lie — and it made the first real
    // memory land in the middle of six strangers' trips.
    experiences: [],
    people: mockPeople,
    businesses: mockBusinesses,
    user: mockUser,
    messages: mockMessages,
    bookings: [],
    reviews: mockReviews,
    boosts: [],
    waitlist: [],
    dismissedNotifications: [],
    supportTickets: [],
    travelers: mockTravelers,
    travelerActivity: mockTravelerActivity,
    banners: [],
    wishlist: [],
  };
}

function loadInitial(): AvenaData {
  const raw = readStored(STORAGE_KEY);
  if (raw) {
    try {
      return { ...defaults(), ...JSON.parse(raw) };
    } catch {
      // fall through to defaults
    }
  }
  return defaults();
}

export function AvenaProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AvenaData>(loadInitial);
  const [storageFull, setStorageFull] = useState(false);
  const storageBlocked = !storageAvailable();

  useEffect(() => {
    // Saying so plainly beats losing the person's memories without a word.
    // Two different failures land here: the browser refuses storage entirely,
    // and the 5 MB quota filled up with photos.
    // A browser that refuses storage is a different message, so it is not
    // reported here as a full disk.
    setStorageFull(!writeStored(STORAGE_KEY, JSON.stringify(data)) && !storageBlocked);
  }, [data, storageBlocked]);

  const value = useMemo<AvenaContextValue>(
    () => ({
      ...data,
      addExperience: (exp) =>
        setData((d) => ({ ...d, experiences: [exp, ...d.experiences] })),
      updateExperience: (exp) =>
        setData((d) => ({
          ...d,
          experiences: d.experiences.map((e) => (e.id === exp.id ? exp : e)),
        })),
      deleteExperience: (id) =>
        setData((d) => ({
          ...d,
          experiences: d.experiences.filter((e) => e.id !== id),
        })),
      ensurePerson: (name) => {
        const trimmed = name.trim();
        const existing = data.people.find(
          (p) => p.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) return existing.id;

        const id = newId();
        // Dark enough that the white initial on top stays readable.
        const palette = ["#d73a1f", "#1f73db", "#3a833e", "#a647d9", "#966c1e"];
        setData((d) => ({
          ...d,
          people: [
            ...d.people,
            { id, name: trimmed, avatarColor: palette[d.people.length % palette.length] },
          ],
        }));
        return id;
      },
      inviteToExperience: (experienceId, personId) =>
        setData((d) => ({
          ...d,
          experiences: d.experiences.map((e) =>
            e.id === experienceId
              ? {
                  ...e,
                  invitedPersonIds: Array.from(
                    new Set([...(e.invitedPersonIds ?? []), personId])
                  ),
                }
              : e
          ),
        })),
      addPerson: (person) =>
        setData((d) => ({ ...d, people: [...d.people, person] })),
      addBusiness: (business) =>
        setData((d) => ({ ...d, businesses: [business, ...d.businesses] })),
      updateUser: (user) =>
        setData((d) => ({ ...d, user: { ...d.user, ...user } })),
      sendMessage: (thread, text) =>
        setData((d) => ({
          ...d,
          messages: [
            ...d.messages,
            {
              id: newId(),
              ...thread,
              sender: "me",
              text,
              timestamp: new Date().toISOString(),
            },
          ],
        })),
      markThreadRead: (thread) =>
        setData((d) => ({
          ...d,
          user: {
            ...d.user,
            threadReads: {
              ...(d.user.threadReads ?? {}),
              [threadKey(thread)]: new Date().toISOString(),
            },
          },
        })),
      addBooking: (booking) =>
        setData((d) => ({ ...d, bookings: [booking, ...d.bookings] })),
      updateBusiness: (businessId, patch) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId ? { ...b, ...patch } : b
          ),
        })),
      addTourToBusiness: (businessId, tour) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId ? { ...b, tours: [...(b.tours ?? []), tour] } : b
          ),
        })),
      updateTour: (businessId, tour) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId
              ? { ...b, tours: (b.tours ?? []).map((t) => (t.id === tour.id ? tour : t)) }
              : b
          ),
        })),
      removeTour: (businessId, tourId) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId
              ? { ...b, tours: (b.tours ?? []).filter((t) => t.id !== tourId) }
              : b
          ),
        })),
      replyToReview: (reviewId, reply) =>
        setData((d) => ({
          ...d,
          reviews: d.reviews.map((r) =>
            r.id === reviewId
              ? { ...r, reply, repliedAt: new Date().toISOString() }
              : r
          ),
        })),
      addReview: (review) =>
        setData((d) => {
          // The rule is enforced here, not only where the form is drawn: a
          // review only exists if a paid, finished, not-yet-reviewed booking
          // backs it. Anything else is silently refused rather than published.
          const booking = d.bookings.find((b) => b.id === review.bookingId);
          if (!booking || !canReview(booking)) return d;

          return {
            ...d,
            reviews: [review, ...d.reviews],
            bookings: d.bookings.map((b) =>
              b.id === review.bookingId ? { ...b, reviewed: true } : b
            ),
          };
        }),
      cancelBooking: (bookingId) =>
        setData((d) => ({
          ...d,
          bookings: d.bookings.map((b) => {
            if (b.id !== bookingId) return b;
            const { refundAmount } = computeRefund(b);
            return {
              ...b,
              status: "cancelada",
              cancelledAt: new Date().toISOString(),
              refundAmount,
            };
          }),
        })),
      declineBooking: (bookingId, reason) =>
        setData((d) => ({
          ...d,
          bookings: d.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: "cancelada",
                  cancelledAt: new Date().toISOString(),
                  // Integral, sempre, e sem olhar a política de cancelamento.
                  // A política existe para quando quem desiste é o viajante;
                  // aqui quem não pôde foi a empresa, e cobrar multa de alguém
                  // por um "não" que não foi dele é indefensável.
                  refundAmount: b.totalPrice,
                  declineReason: reason,
                }
              : b
          ),
        })),
      addBoost: (boost) => setData((d) => ({ ...d, boosts: [boost, ...d.boosts] })),
      joinWaitlist: (entry) =>
        setData((d) => ({ ...d, waitlist: [entry, ...d.waitlist] })),
      leaveWaitlist: (entryId) =>
        setData((d) => ({ ...d, waitlist: d.waitlist.filter((w) => w.id !== entryId) })),
      endBoost: (boostId) =>
        setData((d) => ({
          ...d,
          // Ending a boost expires it now rather than deleting it, so the
          // revenue it generated stays in the books.
          boosts: d.boosts.map((b) =>
            b.id === boostId ? { ...b, endsAt: new Date().toISOString() } : b
          ),
        })),
      setBusinessStatus: (businessId, status) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId ? { ...b, status } : b
          ),
        })),
      setBusinessVerified: (businessId, verified) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId ? { ...b, verified } : b
          ),
        })),
      removeReview: (reviewId) =>
        setData((d) => ({
          ...d,
          reviews: d.reviews.filter((r) => r.id !== reviewId),
        })),
      dismissNotification: (notificationId) =>
        setData((d) => ({
          ...d,
          dismissedNotifications: [...d.dismissedNotifications, notificationId],
        })),
      payBooking: (bookingId, method) =>
        setData((d) => ({
          ...d,
          bookings: d.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: "confirmada",
                  payment: {
                    method,
                    paidAt: new Date().toISOString(),
                    reference: `AV${b.id.slice(0, 8).toUpperCase()}`,
                  },
                }
              : b
          ),
        })),
      openTicket: ({ subject, message, bookingId }) => {
        const ticket: SupportTicket = {
          id: newId(),
          subject,
          message,
          bookingId,
          createdAt: new Date().toISOString(),
          status: "aberto",
          protocol: `AV-${newId().slice(0, 4).toUpperCase()}`,
        };
        setData((d) => ({ ...d, supportTickets: [ticket, ...d.supportTickets] }));
        return ticket;
      },
      replyTicket: (ticketId, reply) =>
        setData((d) => ({
          ...d,
          supportTickets: d.supportTickets.map((t) =>
            t.id === ticketId
              ? { ...t, reply, repliedAt: new Date().toISOString(), status: "respondido" }
              : t
          ),
        })),
      resolveTicket: (ticketId) =>
        setData((d) => ({
          ...d,
          supportTickets: d.supportTickets.map((t) =>
            t.id === ticketId ? { ...t, status: "resolvido" } : t
          ),
        })),
      exportData: () => JSON.stringify({ version: STORAGE_KEY, data }, null, 2),
      importData: (json) => {
        const parsed = JSON.parse(json);
        const incoming = parsed?.data ?? parsed;
        if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.experiences)) {
          // A code, not a sentence: the wording belongs to the translated UI.
          throw new Error("invalid-backup");
        }
        setData({ ...defaults(), ...incoming });
      },
      followTraveler: (travelerId) =>
        setData((d) => {
          const traveler = d.travelers.find((tr) => tr.id === travelerId);
          if (!traveler) return d;
          // A private profile has to accept first, so following it only files
          // a request — the feed stays empty until then.
          const field = traveler.isPrivate ? "followRequests" : "following";
          const current = d.user[field] ?? [];
          if (current.includes(travelerId)) return d;
          return { ...d, user: { ...d.user, [field]: [...current, travelerId] } };
        }),
      unfollowTraveler: (travelerId) =>
        setData((d) => ({
          ...d,
          user: {
            ...d.user,
            following: (d.user.following ?? []).filter((id) => id !== travelerId),
            followRequests: (d.user.followRequests ?? []).filter((id) => id !== travelerId),
          },
        })),
      touchBusinessPresence: (businessId) =>
        setData((d) => {
          const business = d.businesses.find((b) => b.id === businessId);
          if (!business) return d;
          // Only write when the stored time is stale, otherwise every render
          // would touch storage.
          const last = business.lastSeenAt ? new Date(business.lastSeenAt).getTime() : 0;
          if (Date.now() - last < 60_000) return d;
          return {
            ...d,
            businesses: d.businesses.map((b) =>
              b.id === businessId ? { ...b, lastSeenAt: new Date().toISOString() } : b
            ),
          };
        }),
      setMercadoPagoLink: (businessId, link) =>
        setData((d) => ({
          ...d,
          businesses: d.businesses.map((b) =>
            b.id === businessId ? { ...b, mercadoPago: link } : b
          ),
        })),
      addWish: (wish) => setData((d) => ({ ...d, wishlist: [wish, ...d.wishlist] })),
      removeWish: (wishId) =>
        setData((d) => ({ ...d, wishlist: d.wishlist.filter((w) => w.id !== wishId) })),
      toggleWishDone: (wishId) =>
        setData((d) => ({
          ...d,
          wishlist: d.wishlist.map((w) =>
            w.id === wishId
              ? { ...w, doneAt: w.doneAt ? undefined : new Date().toISOString() }
              : w
          ),
        })),
      saveBanner: (banner) =>
        setData((d) => ({
          ...d,
          banners: d.banners.some((b) => b.id === banner.id)
            ? d.banners.map((b) => (b.id === banner.id ? banner : b))
            : [banner, ...d.banners],
        })),
      removeBanner: (bannerId) =>
        setData((d) => ({ ...d, banners: d.banners.filter((b) => b.id !== bannerId) })),
      storageFull,
      storageBlocked,
    }),
    [data, storageFull, storageBlocked]
  );

  return <AvenaContext.Provider value={value}>{children}</AvenaContext.Provider>;
}

export function useAvena() {
  const ctx = useContext(AvenaContext);
  if (!ctx) throw new Error("useAvena must be used within AvenaProvider");
  return ctx;
}
