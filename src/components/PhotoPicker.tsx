import { useRef, useState } from "react";
import {
  MAX_PHOTOS_PER_EXPERIENCE,
  PhotoError,
  dataUrlBytes,
  fileToStoredPhoto,
  formatBytes,
  isImagePhoto,
} from "../lib/photos";

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}

/**
 * Adds real photos to a memory or a tour. Images are downscaled before being
 * stored, and the person sees how much space they are using, because on this
 * version everything lives in the browser.
 */
export function PhotoPicker({
  photos,
  onChange,
  max = MAX_PHOTOS_PER_EXPERIENCE,
  label = "Fotos",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = max - photos.length;
  const totalBytes = photos.filter(isImagePhoto).reduce((sum, p) => sum + dataUrlBytes(p), 0);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    const added: string[] = [];
    for (const file of files) {
      try {
        added.push(await fileToStoredPhoto(file));
      } catch (err) {
        setError(
          err instanceof PhotoError ? err.message : "Não foi possível adicionar esta foto."
        );
      }
    }
    if (added.length) onChange([...photos, ...added]);
    setBusy(false);
    // Lets the same file be picked again after being removed.
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="photo-picker">
      <legend>{label}</legend>
      {hint && <p className="muted photo-picker-hint">{hint}</p>}

      <div className="photo-grid">
        {photos.map((photo, i) => (
          <div key={i} className="photo-thumb">
            {isImagePhoto(photo) ? (
              <img src={photo} alt={`Foto ${i + 1}`} />
            ) : (
              <span className="photo-thumb-emoji" aria-hidden="true">
                {photo}
              </span>
            )}
            <button
              type="button"
              className="photo-remove"
              onClick={() => remove(i)}
              aria-label={`Remover foto ${i + 1}`}
            >
              Remover
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            className="photo-add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Processando…" : "Adicionar foto"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFiles}
        aria-label="Escolher fotos"
      />

      {error && <p className="form-error">{error}</p>}

      <p className="muted photo-picker-hint">
        {photos.length} de {max} fotos
        {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`}. As imagens são
        reduzidas automaticamente para caber no seu aparelho.
      </p>
    </fieldset>
  );
}
