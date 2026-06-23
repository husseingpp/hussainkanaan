import type {
  EonetCategoriesResponse,
  EonetCategory,
  EonetEvent,
  EonetEventsResponse,
} from "../types/eonet";

// NASA EONET sends permissive CORS headers, so direct browser fetch works.
// If that ever changes, point BASE at a thin proxy (see liveearth/CLAUDE.md §6).
const BASE = "https://eonet.gsfc.nasa.gov/api/v3";

export interface EventQueryParams {
  /** "open" (active) or "closed". Omit for the API default. */
  status?: "open" | "closed";
  /** category id, e.g. "wildfires" — filters server-side. */
  category?: string;
  /** max events returned. */
  limit?: number;
  /** events from the last N days. */
  days?: number;
}

export async function fetchEvents(
  params: EventQueryParams = {},
): Promise<EonetEvent[]> {
  const url = new URL(`${BASE}/events`);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.limit != null) url.searchParams.set("limit", String(params.limit));
  if (params.days != null) url.searchParams.set("days", String(params.days));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`EONET events request failed (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as EonetEventsResponse;
  return data.events;
}

export async function fetchCategories(): Promise<EonetCategory[]> {
  const res = await fetch(`${BASE}/categories`);
  if (!res.ok) {
    throw new Error(`EONET categories request failed (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as EonetCategoriesResponse;
  return data.categories;
}
