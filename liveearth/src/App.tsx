import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GlobeView } from "./components/Globe";
import { FilterBar } from "./components/FilterBar";
import { EventPanel } from "./components/EventPanel";
import { StatsBar } from "./components/StatsBar";
import { Legend } from "./components/Legend";
import { useEvents } from "./hooks/useEvents";
import {
  computeStats,
  eventsToPoints,
  filterPoints,
  type GlobePoint,
  type StatusFilter,
} from "./lib/transform";

function readParams(): { category: string; status: StatusFilter } {
  const p = new URLSearchParams(window.location.search);
  const category = p.get("category") ?? "";
  const raw = p.get("status");
  const status: StatusFilter =
    raw === "open" || raw === "closed" || raw === "all" ? raw : "open";
  return { category, status };
}

export default function App() {
  const initial = readParams();
  const [category, setCategory] = useState(initial.category);
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const [selected, setSelected] = useState<GlobePoint | null>(null);

  const { data, isLoading, isError, error, isFetching, dataUpdatedAt, refetch } =
    useEvents();

  // Reflect filters in the URL so links are shareable.
  useEffect(() => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (status !== "open") p.set("status", status);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [category, status]);

  const allPoints = useMemo(() => eventsToPoints(data ?? []), [data]);
  // Stats reflect the current category across all statuses…
  const categoryPoints = useMemo(
    () => filterPoints(allPoints, category, "all"),
    [allPoints, category],
  );
  // …while the markers on the globe respect both category and status.
  const visiblePoints = useMemo(
    () => filterPoints(allPoints, category, status),
    [allPoints, category, status],
  );
  const stats = useMemo(() => computeStats(categoryPoints), [categoryPoints]);

  // Keep the open detail panel in sync with refreshed data; close if it vanished.
  useEffect(() => {
    if (!selected) return;
    const fresh = allPoints.find((p) => p.id === selected.id);
    if (!fresh) setSelected(null);
    else if (fresh !== selected) setSelected(fresh);
  }, [allPoints, selected]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05030f] text-slate-100">
      <div className="cyber-backdrop" />
      <GlobeView
        points={visiblePoints}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      {/* Top overlay: title, stats, filters */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="cyber-title flex items-center gap-2 text-xl sm:text-2xl">
              <span style={{ color: "var(--neon-magenta)" }}>◉</span> LiveEarth
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70 sm:text-sm">
              Live natural events · NASA EONET
            </p>
          </div>
          <StatsBar stats={stats} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
        </div>
        <div className="pointer-events-auto self-start">
          <FilterBar
            category={category}
            status={status}
            visibleCount={visiblePoints.length}
            onCategory={setCategory}
            onStatus={setStatus}
          />
        </div>
      </header>

      <Legend
        className="pointer-events-auto absolute bottom-3 left-3 z-10 hidden sm:block"
        activeCategory={category}
        onSelect={setCategory}
      />

      {selected && <EventPanel point={selected} onClose={() => setSelected(null)} />}

      {/* Loading / error states */}
      {isLoading && (
        <Overlay>
          <Spinner />
          <p className="text-sm text-slate-300">Loading live events…</p>
        </Overlay>
      )}

      {isError && !isLoading && (
        <Overlay>
          <p className="max-w-xs text-center text-sm text-slate-300">
            Couldn&apos;t reach NASA EONET.
            {error instanceof Error ? ` (${error.message})` : ""}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="cyber-glow-cyan rounded-lg border border-cyan-400/70 bg-cyan-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-500/25"
          >
            Retry
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300 shadow-[0_0_14px_rgba(0,234,255,0.5)]" />
  );
}
