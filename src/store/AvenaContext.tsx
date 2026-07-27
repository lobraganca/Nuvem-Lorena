import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Business, Experience, Person, UserProfile } from "../types";
import { mockBusinesses, mockExperiences, mockPeople, mockUser } from "../data/mockData";

const STORAGE_KEY = "avena-data-v3";

interface AvenaData {
  experiences: Experience[];
  people: Person[];
  businesses: Business[];
  user: UserProfile;
}

interface AvenaContextValue extends AvenaData {
  addExperience: (exp: Experience) => void;
  addPerson: (person: Person) => void;
  addBusiness: (business: Business) => void;
  updateUser: (user: Partial<UserProfile>) => void;
}

const AvenaContext = createContext<AvenaContextValue | null>(null);

function defaults(): AvenaData {
  return {
    experiences: mockExperiences,
    people: mockPeople,
    businesses: mockBusinesses,
    user: mockUser,
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
      addPerson: (person) =>
        setData((d) => ({ ...d, people: [...d.people, person] })),
      addBusiness: (business) =>
        setData((d) => ({ ...d, businesses: [business, ...d.businesses] })),
      updateUser: (user) =>
        setData((d) => ({ ...d, user: { ...d.user, ...user } })),
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
