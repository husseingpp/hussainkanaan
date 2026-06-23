import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "../api/eonet";
import type { EonetEvent } from "../types/eonet";

const FIVE_MIN = 5 * 60 * 1000;

/**
 * Fetch the live set of events. We request the open events (currently active)
 * plus recently-closed events from the last 120 days and merge them, so the
 * status filter and the stats counts are meaningful regardless of the API's
 * default behaviour when `status` is omitted.
 */
async function fetchLiveEvents(): Promise<EonetEvent[]> {
  const [open, closed] = await Promise.all([
    fetchEvents({ status: "open", limit: 300 }),
    fetchEvents({ status: "closed", days: 120, limit: 200 }),
  ]);

  const byId = new Map<string, EonetEvent>();
  for (const event of [...open, ...closed]) byId.set(event.id, event);
  const merged = [...byId.values()];

  // Phase 1 QA gate: confirm events are flowing.
  console.info(
    `[LiveEarth] fetched ${merged.length} events (${open.length} open, ${closed.length} closed)`,
  );
  return merged;
}

export function useEvents() {
  return useQuery({
    queryKey: ["eonet", "events"],
    queryFn: fetchLiveEvents,
    refetchInterval: FIVE_MIN, // keep the globe "live"
    staleTime: FIVE_MIN,
  });
}
