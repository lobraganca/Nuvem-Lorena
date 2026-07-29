import { useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BannerSlot } from "../components/BannerSlot";
import { doneWishes, openWishes, partnersForWish } from "../lib/wishlist";
import { categories } from "../lib/categories";
import { BRAZILIAN_STATES } from "../lib/collections";
import { formatBRL } from "../lib/money";
import { localeFor, useI18n } from "../i18n";
import { categoryKey } from "../i18n/domain";
import type { Category, WishlistItem } from "../types";

export function Wishlist() {
  const { wishlist, businesses, addWish, removeWish, toggleWishDone } = useAvena();
  const { t, lang } = useI18n();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [note, setNote] = useState("");

  const open = openWishes(wishlist);
  const done = doneWishes(wishlist);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addWish({
      id: crypto.randomUUID(),
      title: title.trim(),
      city: city.trim() || undefined,
      state: state || undefined,
      category: category || undefined,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setTitle("");
    setCity("");
    setState("");
    setCategory("");
    setNote("");
  }

  function WishCard({ wish }: { wish: WishlistItem }) {
    const partners = partnersForWish(wish, businesses);

    return (
      <div className="booking-card">
        <div className="timeline-card-title">
          {wish.tourId && wish.businessId ? (
            <Link to={`/business/${wish.businessId}`}>{wish.title}</Link>
          ) : (
            wish.title
          )}
          {wish.doneAt && (
            <span className="booking-status booking-status-confirmada">
              {t("wish.doneLabel")}
            </span>
          )}
        </div>

        <div className="muted">
          {[
            wish.city && `${wish.city}${wish.state ? `, ${wish.state}` : ""}`,
            wish.businessName,
            wish.category && t(categoryKey[wish.category]),
            wish.priceFrom !== undefined &&
              `${t("common.from")} R$ ${formatBRL(wish.priceFrom)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>

        {wish.note && <p>{wish.note}</p>}

        {/* A wish is only useful if it can be acted on. */}
        {!wish.doneAt && !wish.tourId && wish.city && (
          <p className="muted">
            {partners.length > 0
              ? t("wish.partnersHere", { count: partners.length, city: wish.city })
              : t("wish.noPartnersYet", { city: wish.city })}
          </p>
        )}

        <div className="chip-row">
          {!wish.doneAt && wish.city && partners.length > 0 && (
            <Link
              to={`/destination?city=${encodeURIComponent(wish.city)}`}
              className="btn-primary"
            >
              {t("wish.seeOptions")}
            </Link>
          )}
          {!wish.doneAt && (
            <Link to="/experience/new" className="btn-outline">
              {t("wish.registerMemory")}
            </Link>
          )}
          <button
            type="button"
            className="btn-outline"
            onClick={() => toggleWishDone(wish.id)}
          >
            {t(wish.doneAt ? "wish.undo" : "wish.markDone")}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => removeWish(wish.id)}
          >
            {t("common.remove")}
          </button>
        </div>

        {wish.doneAt && (
          <div className="muted">
            {t("wish.doneOn", {
              date: new Date(wish.doneAt).toLocaleDateString(localeFor(lang)),
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← {t("common.backToMap")}
      </Link>
      <h1>{t("wish.title")}</h1>
      <p className="muted">{t("wish.subtitle")}</p>

      <BannerSlot placement="wishlist-top" />

      <form className="booking-form" onSubmit={submit}>
        <label>
          {t("wish.whatField")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("wish.whatPlaceholder")}
            required
          />
        </label>
        <div className="form-row">
          <label>
            {t("wish.cityField")}
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            {t("experience.state")}
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">—</option>
              {BRAZILIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("experience.category")}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "")}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(categoryKey[c])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("wish.noteField")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("wish.notePlaceholder")}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={!title.trim()}>
          {t("wish.addToList")}
        </button>
      </form>

      <h2 className="timeline-title">
        {open.length === 1 ? t("wish.countOne") : t("wish.count", { count: open.length })}
      </h2>
      {open.length === 0 && <p className="muted">{t("wish.empty")}</p>}
      <div className="timeline">
        {open.map((wish) => (
          <WishCard key={wish.id} wish={wish} />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="timeline-title">{t("wish.doneTitle")}</h2>
          <div className="timeline">
            {done.map((wish) => (
              <WishCard key={wish.id} wish={wish} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
