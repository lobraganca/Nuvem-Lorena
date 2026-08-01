import { useState } from "react";
import {
  DAY_STATE_LABEL,
  WEEKDAY_NAMES,
  dayState,
  daysOfMonth,
  isBookable,
  todayISO,
  weekdayOf,
  type DayState,
} from "../lib/calendar";
import { holdsSeat } from "../lib/bookingStatus";
import type { Booking, Tour } from "../types";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * O mês, com o que está livre.
 *
 * Serve aos dois lados. Para quem viaja, é onde se escolhe a data vendo quais
 * existem, em vez de tentar uma, levar não, e tentar outra. Para quem recebe,
 * é onde se fecha a semana de férias — o mesmo desenho, com o toque fazendo
 * outra coisa, porque duas grades diferentes para a mesma informação é o
 * caminho mais curto para elas discordarem.
 */
export function AvailabilityCalendar({
  tour,
  bookings,
  selected,
  onPick,
  mode = "escolher",
}: {
  tour: Tour;
  bookings: Booking[];
  selected?: string;
  onPick: (date: string) => void;
  /** "escolher" para quem reserva; "bloquear" para quem recebe. */
  mode?: "escolher" | "bloquear";
}) {
  const today = todayISO();
  const [ano, setAno] = useState(() => Number(today.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(today.slice(5, 7)));

  const dias = daysOfMonth(ano, mes);
  // Casas vazias antes do dia 1, para a coluna bater com o dia da semana.
  const vazios = weekdayOf(dias[0]);

  function vendidas(date: string): number {
    return bookings
      .filter((b) => b.tourId === tour.id && b.travelDate === date && holdsSeat(b))
      .reduce((sum, b) => sum + b.travelers, 0);
  }

  function mover(delta: number) {
    const m = mes + delta;
    if (m < 1) {
      setMes(12);
      setAno(ano - 1);
    } else if (m > 12) {
      setMes(1);
      setAno(ano + 1);
    } else {
      setMes(m);
    }
  }

  const noPassado = ano < Number(today.slice(0, 4)) ||
    (ano === Number(today.slice(0, 4)) && mes <= Number(today.slice(5, 7)));

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => mover(-1)}
          disabled={noPassado}
          aria-label="Mês anterior"
        >
          ←
        </button>
        <strong>
          {MESES[mes - 1]} de {ano}
        </strong>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => mover(1)}
          aria-label="Próximo mês"
        >
          →
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {WEEKDAY_NAMES.map((d) => (
          <span key={d} className="calendar-weekday">
            {d}
          </span>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`vazio-${i}`} />
        ))}
        {dias.map((dia) => {
          const estado: DayState = dayState(tour, dia, vendidas(dia), today);
          const livre = isBookable(estado);
          // Quem bloqueia pode tocar em qualquer dia futuro, inclusive num já
          // bloqueado — é assim que se desbloqueia.
          const podeTocar =
            mode === "bloquear" ? estado !== "passada" : livre;
          return (
            <button
              key={dia}
              type="button"
              className={`calendar-day calendar-day-${estado} ${
                selected === dia ? "calendar-day-on" : ""
              }`}
              onClick={() => podeTocar && onPick(dia)}
              disabled={!podeTocar}
              title={DAY_STATE_LABEL[estado]}
              aria-label={`${Number(dia.slice(8))} — ${DAY_STATE_LABEL[estado]}`}
            >
              {Number(dia.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="calendar-legend">
        {mode === "bloquear"
          ? "Toque num dia para fechar ou reabrir. Dias fechados aparecem riscados."
          : "Os dias apagados não estão disponíveis."}
      </p>
    </div>
  );
}
