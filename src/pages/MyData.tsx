import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { STORAGE_BUDGET_BYTES, dataUrlBytes, formatBytes, isImagePhoto } from "../lib/photos";
import { useT } from "../i18n";

export function MyData() {
  const { exportData, importData, experiences, bookings, people } = useAvena();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const photoBytes = experiences
    .flatMap((e) => e.photos)
    .filter(isImagePhoto)
    .reduce((sum, p) => sum + dataUrlBytes(p), 0);
  const usedPct = Math.min(100, Math.round((photoBytes / STORAGE_BUDGET_BYTES) * 100));

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avena-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(t("myData.downloaded"));
    setError(null);
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(t("myData.confirmRestore"))
    ) {
      return;
    }
    try {
      importData(await file.text());
      setMessage(t("myData.restored"));
      setError(null);
    } catch (err) {
      setError(t("myData.invalidFile"));
      void err;
      setMessage(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="page">
      <Link to="/profile" className="back-link">
        ← {t("common.backToProfile")}
      </Link>
      <h1>{t("myData.title")}</h1>

      <div className="sandbox-warning" role="note">
        <strong>{t("myData.warningTitle")}</strong> {t("myData.warningText")}
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <strong>{experiences.length}</strong>
          <span className="muted">{t("profile.experiences")}</span>
        </div>
        <div className="stat-card">
          <strong>{people.length}</strong>
          <span className="muted">{t("profile.people")}</span>
        </div>
        <div className="stat-card">
          <strong>{bookings.length}</strong>
          <span className="muted">{t("myData.bookings")}</span>
        </div>
      </div>

      <h2 className="timeline-title">{t("myData.storageTitle")}</h2>
      <div
        className="storage-bar"
        role="progressbar"
        aria-valuenow={usedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("myData.storageTitle")}
      >
        <div className="storage-bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="muted">
        {t("myData.storageUsed", {
          used: formatBytes(photoBytes),
          total: formatBytes(STORAGE_BUDGET_BYTES),
          pct: usedPct,
        })}
        {usedPct > 75 && ` ${t("myData.storageWarning")}`}
      </p>

      <h2 className="timeline-title">{t("myData.backup")}</h2>
      <div className="chip-row">
        <button type="button" className="btn-primary" onClick={download}>
          {t("myData.download")}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => inputRef.current?.click()}
        >
          {t("myData.restore")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={restore}
          aria-label={t("myData.restore")}
        />
      </div>

      {message && <p className="availability-note">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      <h2 className="timeline-title">{t("myData.rightsTitle")}</h2>
      <p className="muted">
        {t("myData.rightsText")}{" "}
        <Link to="/privacidade">{t("footer.privacy")}</Link>.
      </p>
    </div>
  );
}
