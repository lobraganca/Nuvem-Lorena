import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import {
  cancellationPolicies,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import { MONTH_NAMES, accessibilityTags, difficulties } from "../lib/tourAttributes";
import { PhotoPicker } from "./PhotoPicker";
import { ModerationNotice, isPublishable } from "./ModerationNotice";
import type { AccessibilityTag, CancellationPolicy, Difficulty, Tour } from "../types";

/** Inline edit + delete for a published tour, so a wrong price is fixable. */
export function EditTour({ businessId, tour }: { businessId: string; tour: Tour }) {
  const { updateTour, removeTour } = useAvena();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(tour.title);
  const [description, setDescription] = useState(tour.description ?? "");
  const [priceFrom, setPriceFrom] = useState(
    tour.priceFrom !== undefined ? String(tour.priceFrom) : ""
  );
  const [durationHours, setDurationHours] = useState(
    tour.durationHours !== undefined ? String(tour.durationHours) : ""
  );
  const [capacityPerDay, setCapacityPerDay] = useState(
    tour.capacityPerDay !== undefined ? String(tour.capacityPerDay) : ""
  );
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(
    tour.cancellationPolicy ?? "moderada"
  );
  const [seasonMonths, setSeasonMonths] = useState<number[]>(tour.seasonMonths ?? []);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(tour.difficulty);
  const [access, setAccess] = useState<AccessibilityTag[]>(tour.accessibility ?? []);
  const [photos, setPhotos] = useState<string[]>(tour.photos ?? []);
  const [included, setIncluded] = useState(tour.included ?? "");
  const [bring, setBring] = useState(tour.bring ?? "");
  const [departureTimes, setDepartureTimes] = useState(tour.departureTimes ?? "");
  const [languages, setLanguages] = useState(tour.languages ?? "");
  const [groupSize, setGroupSize] = useState(
    tour.groupSize !== undefined ? String(tour.groupSize) : ""
  );

  function toggleMonth(m: number) {
    setSeasonMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleAccess(tag: AccessibilityTag) {
    setAccess((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    if (!isPublishable(`${title} ${description}`)) return;
    updateTour(businessId, {
      ...tour,
      title,
      description: description || undefined,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
      capacityPerDay: capacityPerDay ? Number(capacityPerDay) : undefined,
      cancellationPolicy,
      included: included.trim() || undefined,
      bring: bring.trim() || undefined,
      departureTimes: departureTimes.trim() || undefined,
      languages: languages.trim() || undefined,
      groupSize: groupSize ? Number(groupSize) : undefined,
      seasonMonths: seasonMonths.length ? seasonMonths : undefined,
      difficulty,
      accessibility: access.length ? access : undefined,
      photos: photos.length ? photos : undefined,
    });
    setOpen(false);
  }

  function handleDelete() {
    if (
      confirm(
        `Excluir “${tour.title}”? Reservas já feitas continuam válidas, mas o passeio deixa de aparecer para novos viajantes.`
      )
    ) {
      removeTour(businessId, tour.id);
    }
  }

  if (!open) {
    return (
      <div className="chip-row">
        <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
          Editar
        </button>
        <button type="button" className="btn-outline" onClick={handleDelete}>
          Excluir
        </button>
      </div>
    );
  }

  return (
    <form className="booking-form" onSubmit={save}>
      <label>
        Nome do passeio
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Descrição
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </label>
      <div className="form-row">
        <label>
          Preço (R$)
          <input
            type="number"
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
          />
        </label>
        <label>
          Duração (h)
          <input
            type="number"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />
        </label>
        <label>
          Vagas/dia
          <input
            type="number"
            min={1}
            value={capacityPerDay}
            onChange={(e) => setCapacityPerDay(e.target.value)}
          />
        </label>
      </div>
      <div className="chip-row">
        {cancellationPolicies.map((p) => (
          <button
            type="button"
            key={p}
            className={`chip ${cancellationPolicy === p ? "chip-active" : ""}`}
            onClick={() => setCancellationPolicy(p)}
          >
            {cancellationPolicyLabel[p]}
          </button>
        ))}
      </div>
      {/* O que a pessoa pergunta por mensagem quando não está escrito — e
          quando não pergunta, some. */}
      <label>
        O que está incluído
        <textarea
          value={included}
          onChange={(e) => setIncluded(e.target.value)}
          rows={2}
          placeholder="Ex.: guia, equipamento de mergulho, água e fruta"
        />
      </label>

      <label>
        O que levar
        <textarea
          value={bring}
          onChange={(e) => setBring(e.target.value)}
          rows={2}
          placeholder="Ex.: protetor solar, roupa de banho, tênis fechado"
        />
      </label>

      <div className="form-row">
        <label>
          Horários de saída
          <input
            value={departureTimes}
            onChange={(e) => setDepartureTimes(e.target.value)}
            placeholder="08:00 e 14:00"
          />
        </label>
        <label>
          Idiomas
          <input
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="Português e inglês"
          />
        </label>
        <label>
          Tamanho do grupo
          <input
            type="number"
            min={1}
            value={groupSize}
            onChange={(e) => setGroupSize(e.target.value)}
            placeholder="Ex.: 12"
          />
        </label>
      </div>

      <PhotoPicker
        photos={photos}
        onChange={setPhotos}
        max={4}
        label="Fotos do passeio"
        hint="Viajante nenhum reserva sem ver o lugar. Use fotos reais da experiência."
      />

      <fieldset>
        <legend>Melhor época (opcional)</legend>
        <div className="chip-row">
          {MONTH_NAMES.map((name, i) => (
            <button
              type="button"
              key={name}
              className={`chip ${seasonMonths.includes(i + 1) ? "chip-active" : ""}`}
              onClick={() => toggleMonth(i + 1)}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Nível de esforço</legend>
        <div className="chip-row">
          {difficulties.map((d) => (
            <button
              type="button"
              key={d}
              className={`chip ${difficulty === d ? "chip-active" : ""}`}
              onClick={() => setDifficulty(difficulty === d ? undefined : d)}
            >
              {d}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Acessibilidade</legend>
        <div className="chip-row">
          {accessibilityTags.map((t) => (
            <button
              type="button"
              key={t}
              className={`chip ${access.includes(t) ? "chip-active" : ""}`}
              onClick={() => toggleAccess(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="chip-row">
        <ModerationNotice text={`${title} ${description}`} />
        <button
          type="submit"
          className="btn-primary"
          disabled={!isPublishable(`${title} ${description}`)}
        >
          Salvar alterações
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
