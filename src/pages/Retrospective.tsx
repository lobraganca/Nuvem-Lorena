import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { availableYears, buildRetrospective } from "../lib/retrospective";

export function Retrospective() {
  const { experiences, people, bookings } = useAvena();
  const years = availableYears(experiences);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());

  const r = buildRetrospective(year, experiences, people, bookings);

  return (
    <div className="page page-wide">
      <Link to="/profile" className="back-link">
        ← Voltar ao perfil
      </Link>

      <div className="retro-hero">
        <div className="retro-year">{r.year}</div>
        <h1>Sua retrospectiva</h1>
        <p className="muted">O ano que você viveu, em números e memórias.</p>

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
          Nenhuma experiência registrada em {r.year}. Registre suas memórias para
          ver a retrospectiva deste ano.
        </p>
      ) : (
        <>
          <div className="retro-grid">
            <div className="retro-card retro-card-big">
              <div className="retro-number">{r.experiences}</div>
              <div>experiências vividas</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.newPlaces}</div>
              <div>lugares novos</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.cities}</div>
              <div>cidades</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.states}</div>
              <div>estados</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.trails}</div>
              <div>trilhas</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.beaches}</div>
              <div>praias</div>
            </div>
            <div className="retro-card">
              <div className="retro-number">{r.waterfalls}</div>
              <div>cachoeiras</div>
            </div>
          </div>

          {r.busiestMonth && (
            <div className="retro-statement">
              Seu mês mais intenso foi <strong>{r.busiestMonth.month}</strong>, com{" "}
              {r.busiestMonth.count}{" "}
              {r.busiestMonth.count === 1 ? "experiência" : "experiências"}.
            </div>
          )}

          {r.topCompanion && (
            <div className="retro-statement">
              Você viveu {r.topCompanion.count}{" "}
              {r.topCompanion.count === 1 ? "experiência" : "experiências"} ao lado de{" "}
              <strong>{r.topCompanion.name}</strong>.
            </div>
          )}

          {r.animals.length > 0 && (
            <div className="retro-statement">
              Você observou <strong>{r.animals.join(", ")}</strong>.
            </div>
          )}

          {r.bestTrip && (
            <div className="retro-statement">
              Sua viagem mais bem avaliada do ano foi{" "}
              <Link to={`/experience/${r.bestTrip.id}`}>
                <strong>{r.bestTrip.title}</strong>
              </Link>
              , em {r.bestTrip.locationName}.
            </div>
          )}

          {r.completedCollections.length > 0 && (
            <div className="retro-statement">
              Coleções concluídas: <strong>{r.completedCollections.join(", ")}</strong>.
            </div>
          )}

          {r.spent > 0 && (
            <div className="retro-statement">
              Você investiu <strong>R$ {r.spent.toLocaleString("pt-BR")}</strong> em
              passeios reservados pelo Avena.
            </div>
          )}
        </>
      )}
    </div>
  );
}
