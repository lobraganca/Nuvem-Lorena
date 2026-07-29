import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Booking, Boost, Business, BusinessStatus, Experience, Message, MessageThread, Person, Review, Tour, UserProfile } from "../types";
import {
  mockBusinesses,
  mockExperiences,
  mockMessages,
  mockPeople,
  mockReviews,
  mockUser,
} from "../data/mockData";
import { computeRefund } from "../lib/cancellation";

const STORAGE_KEY = "avena-data-v13";

interface AvenaData {
  experiences: Experience[];
  people: Person[];
  businesses: Business[];
  user: UserProfile;
  messages: Message[];
  bookings: Booking[];
  reviews: Review[];
  boosts: Boost[];
  dismissedNotifications: string[];
}

interface AvenaContextValue extends AvenaData {
  addExperience: (exp: Experience) => void;
  updateExperience: (exp: Experience) => void;
  deleteExperience: (id: string) => void;
  addPerson: (person: Person) => void;
  addBusiness: (business: Business) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  sendMessage: (thread: MessageThread, text: string) => void;
  addBooking: (booking: Booking) => void;
  addTourToBusiness: (businessId: string, tour: Tour) => void;
  updateTour: (businessId: string, tour: Tour) => void;
  removeTour: (businessId: string, tourId: string) => void;
  addReview: (review: Review) => void;
  cancelBooking: (bookingId: string) => void;
  addBoost: (boost: Boost) => void;
  endBoost: (boostId: string) => void;
  setBusinessStatus: (businessId: string, status: BusinessStatus) => void;
  setBusinessVerified: (businessId: string, verified: boolean) => void;
  removeReview: (reviewId: string) => void;
  dismissNotification: (notificationId: string) => void;
}

const AvenaContext = createContext<AvenaContextValue | null>(null);

function defaults(): AvenaData {
  return {
    experiences: mockExperiences,
    people: mockPeople,
    businesses: mockBusinesses,
    user: mockUser,
    messages: mockMessages,
    bookings: [],
    reviews: mockReviews,
    boosts: [],
    dismissedNotifications: [],
  };
}

function loadInitial(): AvenaData {
  const raw = localStorage.getItem(STORAGE_KEY);
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

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
              id: crypto.randomUUID(),
              ...thread,
              sender: "me",
              text,
              timestamp: new Date().toISOString(),
            },
          ],
        })),
      addBooking: (booking) =>
        setData((d) => ({ ...d, bookings: [booking, ...d.bookings] })),
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
      addReview: (review) =>
        setData((d) => ({
          ...d,
          reviews: [review, ...d.reviews],
          bookings: d.bookings.map((b) =>
            b.id === review.bookingId ? { ...b, reviewed: true } : b
          ),
        })),
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
      addBoost: (boost) => setData((d) => ({ ...d, boosts: [boost, ...d.boosts] })),
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
    }),
    [data]
  );

  return <AvenaContext.Provider value={value}>{children}</AvenaContext.Provider>;
}

export function useAvena() {
  const ctx = useContext(AvenaContext);
  if (!ctx) throw new Error("useAvena must be used within AvenaProvider");
  return ctx;
}
