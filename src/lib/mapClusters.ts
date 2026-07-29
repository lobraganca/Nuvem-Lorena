import type { Experience } from "../types";

export interface Cluster {
  id: string;
  lat: number;
  lng: number;
  items: Experience[];
}

const TILE_SIZE = 256;
/** Pins closer than this many screen pixels are merged into one cluster. */
const CELL_PIXELS = 64;

/** Web Mercator projection, in pixels, at a given zoom level. */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clamped = Math.max(-85.05, Math.min(85.05, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * Groups nearby experiences so pins stop stacking on top of each other.
 *
 * Grouping happens in screen space, not in degrees, so the behaviour is the
 * same whether you are looking at the whole of Brazil or at one beach: two
 * pins merge when they would visually overlap at the current zoom.
 */
export function clusterExperiences(experiences: Experience[], zoom: number): Cluster[] {
  const cells = new Map<string, Experience[]>();

  for (const exp of experiences) {
    const { x, y } = project(exp.lat, exp.lng, zoom);
    const key = `${Math.floor(x / CELL_PIXELS)}:${Math.floor(y / CELL_PIXELS)}`;
    const cell = cells.get(key);
    if (cell) cell.push(exp);
    else cells.set(key, [exp]);
  }

  return [...cells.entries()].map(([key, items]) => ({
    id: key,
    // The cluster sits at the average position of its members, so it lands
    // where the pins actually are instead of at the centre of a grid cell.
    lat: items.reduce((sum, e) => sum + e.lat, 0) / items.length,
    lng: items.reduce((sum, e) => sum + e.lng, 0) / items.length,
    items,
  }));
}
