import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Experience, Person } from "../types";
import { mockExperiences, mockPeople } from "../data/mockData";

const STORAGE_KEY = "avena-data-v1";

interface AvenaData {
  experiences: Experience[];
  people: Person[];
}

interface AvenaContextValue extends AvenaData {
  addExperience: (exp: Experience) => void;
  addPerson: (person: Person) => void;
}

const AvenaContext = createContext<AvenaContextValue | null>(null);

function loadInitial(): AvenaData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to defaults
    }
  }
  return { experiences: mockExperiences, people: mockPeople };
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
