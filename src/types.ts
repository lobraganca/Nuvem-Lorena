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
