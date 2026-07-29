import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categories } from "../lib/categories";
import { BRAZILIAN_STATES } from "../lib/collections";
import type { Category, Experience } from "../types";

const MOODS = ["😍", "😄", "🥰", "💪", "🤩", "😌", "😢"];

export function AddExperience() {
  const { addExperience, updateExperience, experiences, people } = useAvena();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = experiences.find((e) => e.id === id);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<Category>(editing?.category ?? "Viagem");
  const [locationName, setLocationName] = useState(editing?.locationName ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [state, setState] = useState(editing?.state ?? BRAZILIAN_STATES[0]);
  const [lat, setLat] = useState(editing ? String(editing.lat) : "");
  const [lng, setLng] = useState(editing ? String(editing.lng) : "");
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [diary, setDiary] = useState(editing?.diary ?? "");
  const [rating, setRating] = useState(editing?.rating ?? 5);
  const [mood, setMood] = useState(editing?.mood ?? MOODS[0]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>(editing?.peopleIds ?? []);
  const [agency, setAgency] = useState(editing?.agency ?? "");
  const [guide, setGuide] = useState(editing?.guide ?? "");
  const [animals, setAnimals] = useState(editing?.animalsSeen?.join(", ") ?? "");
  const [restaurants, setRestaurants] = useState(editing?.restaurants?.join(", ") ?? "");
  const [expenses, setExpenses] = useState(editing?.expenses !== undefined ? String(editing.expenses) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !locationName || !lat || !lng) return;

    const exp: Experience = {
      id: editing?.id ?? crypto.randomUUID(),
      title,
      category,
      lat: Number(lat),
      lng: Number(lng),
      locationName,
      city: city || locationName,
      state,
      country: "Brasil",
      date,
      photos: editing?.photos ?? [],
      diary: diary || undefined,
      rating,
      mood,
      peopleIds: selectedPeople,
      agency: agency || undefined,
      guide: guide || undefined,
      animalsSeen: animals ? animals.split(",").map((a) => a.trim()) : undefined,
      restaurants: restaurants
        ? restaurants.split(",").map((r) => r.trim())
        : undefined,
      expenses: expenses ? Number(expenses) : undefined,
      notes: notes || undefined,
    };

    if (editing) {
      updateExperience(exp);
      navigate(`/experience/${exp.id}`);
    } else {
      addExperience(exp);
      navigate("/");
    }
  }

  return (
    <div className="page">
      <h1>{editing ? "Editar experiência" : "Nova experiência"}</h1>
      <form className="experience-form" onSubmit={handleSubmit}>
        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            Local
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
          </label>
          <label>
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="form-row">
          <label>
            Cidade
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            Estado
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {BRAZILIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            País
            <input value="Brasil" disabled />
          </label>
        </div>

        <div className="form-row">
          <label>
            Latitude
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-22.9661" required />
          </label>
          <label>
            Longitude
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-42.0278" required />
          </label>
        </div>

        <label>
          Diário
          <textarea value={diary} onChange={(e) => setDiary(e.target.value)} rows={4} />
        </label>

        <div className="form-row">
          <label>
            Avaliação
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {"⭐".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Humor do dia
            <select value={mood} onChange={(e) => setMood(e.target.value)}>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>Pessoas presentes</legend>
          <div className="chip-row">
            {people.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`chip ${selectedPeople.includes(p.id) ? "chip-active" : ""}`}
                onClick={() => togglePerson(p.id)}
                style={{ borderColor: p.avatarColor }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-row">
          <label>
            Agência
            <input value={agency} onChange={(e) => setAgency(e.target.value)} />
          </label>
          <label>
            Guia
            <input value={guide} onChange={(e) => setGuide(e.target.value)} />
          </label>
        </div>

        <label>
          Animais observados (separados por vírgula)
          <input value={animals} onChange={(e) => setAnimals(e.target.value)} />
        </label>

        <label>
          Restaurantes visitados (separados por vírgula)
          <input value={restaurants} onChange={(e) => setRestaurants(e.target.value)} />
        </label>

        <label>
          Gastos (R$, opcional)
          <input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
        </label>

        <label>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>

        <button type="submit" className="btn-primary">
          {editing ? "Salvar alterações" : "Salvar experiência"}
        </button>
      </form>
    </div>
  );
}
