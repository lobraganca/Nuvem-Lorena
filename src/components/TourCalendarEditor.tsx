import { useAvena } from "../store/AvenaContext";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { WEEKDAY_NAMES } from "../lib/calendar";
import type { Tour } from "../types";

/**
 * A agenda de um passeio, do lado de quem recebe.
 *
 * Duas ferramentas, porque há dois tipos de ausência. A folga fixa — não sai
 * barco às segundas — se resolve uma vez, marcando o dia da semana. A ausência
 * de uma vez só — a semana de férias, o casamento da filha, a obra na casa —
 * se resolve tocando nos dias.
 *
 * Sem isto, o app vendia o Natal e a agência descobria depois do dinheiro ter
 * entrado, o que é o pior momento possível para dizer não a alguém.
 */
export function TourCalendarEditor({
  businessId,
  tour,
}: {
  businessId: string;
  tour: Tour;
}) {
  const { bookings, updateTour } = useAvena();
  const bloqueadas = tour.blockedDates ?? [];
  const fechados = tour.closedWeekdays ?? [];

  function alternarData(date: string) {
    const proximas = bloqueadas.includes(date)
      ? bloqueadas.filter((d) => d !== date)
      : [...bloqueadas, date].sort();
    updateTour(businessId, {
      ...tour,
      blockedDates: proximas.length ? proximas : undefined,
    });
  }

  function alternarDiaDaSemana(dia: number) {
    const proximos = fechados.includes(dia)
      ? fechados.filter((d) => d !== dia)
      : [...fechados, dia].sort();
    updateTour(businessId, {
      ...tour,
      closedWeekdays: proximos.length ? proximos : undefined,
    });
  }

  return (
    <div className="tour-calendar-editor">
      <h4>Agenda de {tour.title}</h4>

      <fieldset>
        <legend>Dias em que não há saída</legend>
        <div className="chip-row">
          {WEEKDAY_NAMES.map((nome, i) => (
            <button
              type="button"
              key={nome}
              className={`chip ${fechados.includes(i) ? "chip-active" : ""}`}
              onClick={() => alternarDiaDaSemana(i)}
              aria-pressed={fechados.includes(i)}
            >
              {nome}
            </button>
          ))}
        </div>
        <p className="muted">
          Marcado = fechado toda semana nesse dia. Serve para a folga fixa.
        </p>
      </fieldset>

      <AvailabilityCalendar
        tour={tour}
        bookings={bookings}
        onPick={alternarData}
        mode="bloquear"
      />

      {bloqueadas.length > 0 && (
        <p className="muted">
          {bloqueadas.length}{" "}
          {bloqueadas.length === 1 ? "data fechada" : "datas fechadas"} à mão.
        </p>
      )}
    </div>
  );
}
