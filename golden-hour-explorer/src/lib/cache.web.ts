import type { Spot } from "./types";

const KEY = "gh:spots";

export function dedupById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function cacheSpots(spots: Spot[]): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(dedupById(spots)));
  } catch {
    // localStorage quota or unavailable — best effort
  }
}

export async function getCachedSpots(): Promise<Spot[]> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Spot[]) : [];
  } catch {
    return [];
  }
}
