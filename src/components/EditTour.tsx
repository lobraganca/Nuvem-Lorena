import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import {
  cancellationPolicies,
  cancellationPolicyLabel,
} from "../lib/cancellation";
import type { CancellationPolicy, Tour } from "../types";

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

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    updateTour(businessId, {
      ...tour,
      title,
      description: description || undefined,
      priceFrom: priceFrom ? Number(priceFrom) : undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
      capacityPerDay: capacityPerDay ? Number(capacityPerDay) : undefined,
      cancellationPolicy,
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
      <div className="chip-row">
        <button type="submit" className="btn-primary">
          Salvar alterações
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
