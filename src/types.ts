export type Category =
  | "Viagem"
  | "Trilha"
  | "Praia"
  | "Cachoeira"
  | "Observação de animais"
  | "Restaurante"
  | "Museu"
  | "Parque"
  | "Cidade"
  | "Outro";

export interface Person {
  id: string;
  name: string;
  avatarColor: string;
}

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarPhoto?: string; // data URL
  avatarColor: string;
}

export type BusinessType = "Agência" | "Guia" | "Restaurante";

export type PlanTier = "Básico" | "Pro" | "Avançado";

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  planTier: PlanTier;
  description: string;
  city: string;
  state?: string;
  country: string;
  email: string;
  phone?: string;
  website?: string;
  createdAt: string; // ISO date
}

export interface Experience {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lng: number;
  locationName: string;
  city: string;
  state?: string;
  country: string;
  date: string; // ISO date
  photos: string[]; // emoji/placeholder urls
  diary?: string;
  rating?: number; // 1-5
  mood?: string;
  peopleIds: string[];
  agency?: string;
  guide?: string;
  animalsSeen?: string[];
  restaurants?: string[];
  expenses?: number;
  notes?: string;
}
