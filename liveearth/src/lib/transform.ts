import type { EonetEvent, EonetGeometry } from "../types/eonet";

/** A single plottable marker derived from an EONET event. */
export interface GlobePoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
  categoryId: string;
  categoryTitle: string;
  date: string; // ISO timestamp of the most-recent geometry
  closed: string | null;
  link: string; // EONET event page
  sourceUrl: string | null; // primary external source
  event: EonetEvent; // full event, for the detail panel
}

export type StatusFilter = "all" | "open" | "closed";

// Per-category marker colours. Keys match EONET category ids.
export const CATEGORY_COLORS: Record<string, string> = {
  drought: "#d9a441",
  dustHaze: "#b8895b",
  earthquakes: "#a855f7",
  floods: "#3b82f6",
  landslides: "#8b5e34",
  manmade: "#9ca3af",
  seaLakeIce: "#67e8f9",
  severeStorms: "#22d3ee",
  snow: "#e2e8f0",
  tempExtremes: "#fb923c",
  volcanoes: "#ef4444",
  wildfires: "#f59e0b",
  waterColor: "#14b8a6",
};

const DEFAULT_COLOR = "#34d399";

export function categoryColor(id: string): string {
  return CATEGORY_COLORS[id] ?? DEFAULT_COLOR;
}

/**
 * Resolve an event's *current* position from its geometry array.
 * - Uses the LAST geometry entry (most recent position, e.g. a storm track).
 * - EONET coordinates are [lng, lat] — we swap them to { lat, lng }.
 * - Polygon fallback: take the first ring's first vertex so it still plots.
 */
function currentPosition(
  geometry: EonetGeometry[],
): { lat: number; lng: number; date: string } | null {
  if (!geometry || geometry.length === 0) return null;
  const g = geometry[geometry.length - 1];

  if (g.type === "Point") {
    const coords = g.coordinates as number[];
    const [lng, lat] = coords;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng, date: g.date };
    }
    return null;
  }

  // Polygon: coordinates are an array of linear rings of [lng, lat].
  const rings = g.coordinates as number[][][];
  const first = rings?.[0]?.[0];
  if (first && first.length >= 2) {
    const [lng, lat] = first;
    return { lat, lng, date: g.date };
  }
  return null;
}

export function eventsToPoints(events: EonetEvent[]): GlobePoint[] {
  const points: GlobePoint[] = [];
  for (const event of events) {
    const pos = currentPosition(event.geometry);
    if (!pos) continue; // skip anything we can't place

    const category = event.categories[0];
    points.push({
      id: event.id,
      lat: pos.lat,
      lng: pos.lng,
      color: categoryColor(category?.id ?? ""),
      title: event.title,
      categoryId: category?.id ?? "",
      categoryTitle: category?.title ?? "Unknown",
      date: pos.date,
      closed: event.closed,
      link: event.link,
      sourceUrl: event.sources?.[0]?.url ?? null,
      event,
    });
  }
  return points;
}

/**
 * Filter points by a set of *hidden* category ids (toggle individual categories
 * off while keeping the rest) and by status.
 */
export function filterPoints(
  points: GlobePoint[],
  hidden: Set<string>,
  status: StatusFilter,
): GlobePoint[] {
  return points.filter((p) => {
    if (hidden.has(p.categoryId)) return false;
    if (status === "open" && p.closed) return false;
    if (status === "closed" && !p.closed) return false;
    return true;
  });
}

export interface Stats {
  total: number;
  active: number;
  closed: number;
}

export function computeStats(points: GlobePoint[]): Stats {
  let active = 0;
  let closed = 0;
  for (const p of points) {
    if (p.closed) closed++;
    else active++;
  }
  return { total: points.length, active, closed };
}
