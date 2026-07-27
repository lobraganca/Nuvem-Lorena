import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categories } from "../lib/categories";
import type { Category, Experience } from "../types";

const MOODS = ["😍", "😄", "🥰", "💪", "🤩", "😌", "😢"];

export function AddExperience() {
  const { addExperience, people } = useAvena();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Viagem");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [diary, setDiary] = useState("");
  const [rating, setRating] = useState(5);
  const [mood, setMood] = useState(MOODS[0]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [agency, setAgency] = useState("");
  const [guide, setGuide] = useState("");
  const [animals, setAnimals] = useState("");
  const [restaurants, setRestaurants] = useState("");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !locationName || !lat || !lng) return;

    const exp: Experience = {
      id: crypto.randomUUID(),
      title,
      category,
      lat: Number(lat),
      lng: Number(lng),
      locationName,
      city: city || locationName,
      state: state || undefined,
      country,
      date,
      photos: [],
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

    addExperience(exp);
    navigate("/");
  }

  return (
    <div className="page">
      <h1>Nova experiência</h1>
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
            <input value={state} onChange={(e) => setState(e.target.value)} />
          </label>
          <label>
            País
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
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
          Salvar experiência
        </button>
      </form>
    </div>
  );
}
