import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { POPULAR_DESTINATIONS } from "../lib/destinations";
import { categoryForTour } from "../lib/categories";
import { newId } from "../lib/ids";
import { useT } from "../i18n";
import type { Destination } from "../lib/destinations";
import type { Experience } from "../types";

/**
 * The whole welcome, in one question.
 *
 * What used to be here was a fork — "are you a tourist or a professional?" —
 * asked before the person had seen anything the app does. Nobody knows what
 * they are before they know what it is, and an empty app teaches nothing. So
 * now the first screen asks where their last trip was, and by the second tap
 * there is a memory on their map. The rest of the app can wait; a person with
 * something of their own in it will go looking.
 */
export function FirstMemory() {
  const { addExperience, updateUser } = useAvena();
  const navigate = useNavigate();
  const t = useT();

  const [place, setPlace] = useState<Destination | null>(null);
  const [what, setWhat] = useState("");
  const [filter, setFilter] = useState("");

  // Twenty-six chips is a wall. Ten is a glance, and typing two letters finds
  // the rest — the list is short enough that a filter beats a "show more".
  const term = filter.trim().toLowerCase();
  const shown = term
    ? POPULAR_DESTINATIONS.filter(
        (d) =>
          d.city.toLowerCase().includes(term) || d.state.toLowerCase() === term
      )
    : POPULAR_DESTINATIONS.slice(0, 10);

  function save() {
    if (!place) return;
    const title = what.trim() || t("first.defaultTitle", { city: place.city });
    const memory: Experience = {
      id: newId(),
      title,
      category: categoryForTour(title),
      lat: place.lat,
      lng: place.lng,
      locationName: place.city,
      city: place.city,
      state: place.state,
      country: "Brasil",
      date: new Date().toISOString().slice(0, 10),
      photos: [],
      peopleIds: [],
    };
    addExperience(memory);
    updateUser({ accountType: "turista" });
    navigate("/");
  }

  /** Somewhere off the list, or nothing to record yet: the app opens anyway. */
  function skip() {
    updateUser({ accountType: "turista" });
    navigate("/");
  }

  return (
    <div className="first-memory">
      <div className="first-inner">
        {place === null ? (
          <>
            <h1>{t("first.question")}</h1>
            <p className="muted">{t("first.questionHint")}</p>

            <input
              className="first-filter"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("first.filterPlaceholder")}
              aria-label={t("first.filterPlaceholder")}
            />

            <div className="first-places">
              {shown.map((d) => (
                <button
                  key={d.city}
                  type="button"
                  className="first-place"
                  onClick={() => setPlace(d)}
                >
                  <span className="first-place-city">{d.city}</span>
                  <span className="first-place-state">{d.state}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 && (
              <p className="muted">{t("first.noMatch", { term: filter.trim() })}</p>
            )}

            <div className="first-escape">
              {/* Two ways out, both real: the full form for a place off the
                  list, and skipping for someone who just wants to look. */}
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  updateUser({ accountType: "turista" });
                  navigate("/experience/new");
                }}
              >
                {t("first.otherPlace")}
              </button>
              <button type="button" className="signin-quiet" onClick={skip}>
                {t("first.skip")}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="signin-back"
              onClick={() => setPlace(null)}
            >
              ← {t("common.back")}
            </button>
            <h1>{t("first.whatTitle", { city: place.city })}</h1>
            <p className="muted">{t("first.whatHint")}</p>

            <input
              className="first-what"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={t("first.whatPlaceholder")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />

            <button type="button" className="btn-primary first-save" onClick={save}>
              {t("first.save")}
            </button>
            <button type="button" className="signin-quiet" onClick={save}>
              {t("first.saveWithoutText")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
