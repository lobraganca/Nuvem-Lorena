import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { categories } from "../lib/categories";
import { BRAZILIAN_STATES } from "../lib/collections";
import { categoryForTour } from "../lib/categories";
import { PhotoPicker } from "../components/PhotoPicker";
import { LocationPicker } from "../components/LocationPicker";
import type { Category, Experience } from "../types";
import { useT } from "../i18n";
import { categoryKey } from "../i18n/domain";

const MOODS = ["😍", "😄", "🥰", "💪", "🤩", "😌", "😢"];

export function AddExperience() {
  const { addExperience, updateExperience, experiences, people, bookings, businesses, ensurePerson } =
    useAvena();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editing = experiences.find((e) => e.id === id);

  // Coming from a finished booking: everything the purchase already knows is
  // filled in, so the person only adds photos and the story.
  const fromBooking = bookings.find((b) => b.id === searchParams.get("booking"));
  const bookingBusiness = fromBooking
    ? businesses.find((b) => b.id === fromBooking.businessId)
    : undefined;

  const seed = editing
    ? undefined
    : fromBooking
      ? {
          title: fromBooking.tourTitle,
          date: fromBooking.travelDate,
          locationName: bookingBusiness?.city ?? "",
          city: bookingBusiness?.city ?? "",
          state: bookingBusiness?.state,
          agency: fromBooking.businessName,
          category: categoryForTour(fromBooking.tourTitle),
        }
      : undefined;

  const [title, setTitle] = useState(editing?.title ?? seed?.title ?? "");
  const [category, setCategory] = useState<Category>(editing?.category ?? seed?.category ?? "Viagem");
  const [locationName, setLocationName] = useState(editing?.locationName ?? seed?.locationName ?? "");
  const [city, setCity] = useState(editing?.city ?? seed?.city ?? "");
  const [state, setState] = useState(editing?.state ?? seed?.state ?? BRAZILIAN_STATES[0]);
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const [date, setDate] = useState(editing?.date ?? seed?.date ?? new Date().toISOString().slice(0, 10));
  const [diary, setDiary] = useState(editing?.diary ?? "");
  const [rating, setRating] = useState(editing?.rating ?? 5);
  const [mood, setMood] = useState(editing?.mood ?? MOODS[0]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>(() => {
    if (editing) return editing.peopleIds;
    if (!fromBooking) return [];
    // Everyone on the passenger list except the buyer becomes a tagged person.
    return fromBooking.participants
      .slice(1)
      .map((p) => ensurePerson(p.name));
  });
  const [agency, setAgency] = useState(editing?.agency ?? seed?.agency ?? "");
  const [guide, setGuide] = useState(editing?.guide ?? "");
  const [animals, setAnimals] = useState(editing?.animalsSeen?.join(", ") ?? "");
  const [restaurants, setRestaurants] = useState(editing?.restaurants?.join(", ") ?? "");
  const [expenses, setExpenses] = useState(editing?.expenses !== undefined ? String(editing.expenses) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [locationError, setLocationError] = useState<string | null>(null);
  const t = useT();

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !locationName) return;
    if (lat === null || lng === null) {
      setLocationError(t("experience.pickOnMap"));
      return;
    }

    const exp: Experience = {
      id: editing?.id ?? crypto.randomUUID(),
      title,
      category,
      lat,
      lng,
      locationName,
      city: city || locationName,
      state,
      country: "Brasil",
      date,
      photos,
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
      bookingId: fromBooking?.id ?? editing?.bookingId,
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
      <h1>{t(editing ? "experience.editTitle" : "experience.newTitle")}</h1>
      {fromBooking && (
        <div className="insight-card">
          {t("experience.fromBooking", { name: fromBooking.businessName })}
        </div>
      )}
      <form className="experience-form" onSubmit={handleSubmit}>
        <label>
          {t("experience.title")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          {t("experience.category")}
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(categoryKey[c])}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            {t("experience.place")}
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
          </label>
          <label>
            {t("experience.date")}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="form-row">
          <label>
            {t("experience.city")}
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            {t("experience.state")}
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {BRAZILIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("experience.country")}
            <input value="Brasil" disabled />
          </label>
        </div>

        <fieldset>
          <legend>{t("experience.whereWasIt")}</legend>
          <LocationPicker
            lat={lat}
            lng={lng}
            category={category}
            onPick={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
              setLocationError(null);
            }}
          />
          {locationError && <p className="form-error">{locationError}</p>}
        </fieldset>

        <PhotoPicker
          photos={photos}
          onChange={setPhotos}
          hint={t("experience.photosHint")}
        />

        <label>
          {t("experience.diary")}
          <textarea value={diary} onChange={(e) => setDiary(e.target.value)} rows={4} />
        </label>

        <div className="form-row">
          <label>
            {t("experience.rating")}
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {"⭐".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("experience.mood")}
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
          <legend>{t("experience.peoplePresent")}</legend>
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
            {t("experience.agency")}
            <input value={agency} onChange={(e) => setAgency(e.target.value)} />
          </label>
          <label>
            {t("experience.guide")}
            <input value={guide} onChange={(e) => setGuide(e.target.value)} />
          </label>
        </div>

        <label>
          {t("experience.animals")}
          <input value={animals} onChange={(e) => setAnimals(e.target.value)} />
        </label>

        <label>
          {t("experience.restaurants")}
          <input value={restaurants} onChange={(e) => setRestaurants(e.target.value)} />
        </label>

        <label>
          {t("experience.expenses")}
          <input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
        </label>

        <label>
          {t("experience.notes")}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>

        <button type="submit" className="btn-primary">
          {t(editing ? "common.saveChanges" : "experience.save")}
        </button>
      </form>
    </div>
  );
}
