/**
 * Photo handling for a browser-only app.
 *
 * Everything the person saves lives in localStorage, which holds roughly 5 MB
 * in total. A single photo straight from a phone camera is 3-6 MB, so storing
 * the file as-is would blow the whole budget on one memory. Every image is
 * therefore redrawn on a canvas at a sane size before being stored, which
 * brings a typical photo down to 100-250 KB.
 */

export const MAX_PHOTOS_PER_EXPERIENCE = 6;

/** Longest side, in pixels, of a stored photo. Enough for a full-width phone screen. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

/** Rough localStorage ceiling in browsers, used to warn before we hit it. */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

/** Carries a translation key so the message can be shown in any language. */
export type PhotoErrorKey = "photos.notAnImage" | "photos.readError";

export class PhotoError extends Error {
  messageKey: PhotoErrorKey;

  constructor(messageKey: PhotoErrorKey) {
    super(messageKey);
    this.messageKey = messageKey;
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoError("photos.readError"));
    img.src = dataUrl;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new PhotoError("photos.readError"));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns a picked file into a small JPEG data URL, preserving the aspect ratio.
 * Rejects anything that is not an image so a stray PDF cannot corrupt the map.
 */
export async function fileToStoredPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new PhotoError("photos.notAnImage");
  }

  const original = await readFile(file);
  const img = await loadImage(original);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("photos.readError");

  // A white base keeps transparent PNGs from turning black once encoded as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Approximate byte size of a data URL, which is base64 and therefore ~4/3 of the bytes. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round((base64.length * 3) / 4);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Older memories were seeded with emoji in the photos field. They are still
 * valid data, so the UI has to tell the two apart rather than break.
 */
export function isImagePhoto(photo: string): boolean {
  return photo.startsWith("data:image") || photo.startsWith("http");
}
