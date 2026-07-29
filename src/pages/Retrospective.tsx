import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { availableYears, buildRetrospective } from "../lib/retrospective";
import { formatBRL } from "../lib/money";
import { useT } from "../i18n";

export function Retrospective() {
  const { experiences, people, bookings } = useAvena();
  const years = availableYears(experiences);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const t = useT();

  const r = buildRetrospective(year, experiences, people, bookings);

  return (
    <div className="page page-wide">
      <Link to="/profile" className="back-link">
        ← {t("common.backToProfile")}
      </Link>

      <div className="retro-hero">
        <div className="retro-year">{r.year}</div>
        <h1>{t("retro.title")}</h1>
        <p className="muted">{t("retro.subtitle")}</p>

        {years.length > 1 && (
          <div className="chip-row" style={{ justifyContent: "center", marginTop: 12 }}>
            {years.map((y) => (
              <button
                key={y}
                className={`chip ${y === year ? "chip-active" : ""}`}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {!r.hasData ? (
        <p className="muted">
          {t("retro.empty", { year: r.year })}
        </p>
      ) : (
        <>
          <div className="retro-grid">
            <div className="retro-card retro-card-big">
              <div className="retro-number">{r.experiences}</div>
              <div>{t("retro.experiences")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.newPlaces}</div>
              <div>{t("retro.newPlaces")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.cities}</div>
              <div>{t("retro.cities")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.states}</div>
              <div>{t("retro.states")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.trails}</div>
              <div>{t("retro.trails")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.beaches}</div>
              <div>{t("retro.beaches")}</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.waterfalls}</div>
              <div>{t("retro.waterfalls")}</div>
            </div>
          </div>

          {r.busiestMonth && (
            <div className="retro-statement">
              {t("retro.busiestMonth", {
                month: r.busiestMonth.month,
                count: r.busiestMonth.count,
              })}
            </div>
          )}

          {r.topCompanion && (
            <div className="retro-statement">
              {t("retro.topCompanion", {
                count: r.topCompanion.count,
                name: r.topCompanion.name,
              })}
            </div>
          )}

          {r.animals.length > 0 && (
            <div className="retro-statement">
              {t("retro.animals", { list: r.animals.join(", ") })}
            </div>
          )}

          {r.bestTrip && (
            <div className="retro-statement">
              {t("retro.bestTrip")}{" "}
              <Link to={`/experience/${r.bestTrip.id}`}>
                <strong>{r.bestTrip.title}</strong>
              </Link>
              , {r.bestTrip.locationName}.
            </div>
          )}

          {r.completedCollections.length > 0 && (
            <div className="retro-statement">
              {t("retro.collections")}:{" "}
              <strong>{r.completedCollections.map((k) => t(k)).join(", ")}</strong>.
            </div>
          )}

          {r.spent > 0 && (
            <div className="retro-statement">
              {t("retro.spent", { amount: formatBRL(r.spent) })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
