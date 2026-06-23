import { useEffect, useState } from "react";
import type { Stats } from "../lib/transform";

interface Props {
  stats: Stats;
  isFetching: boolean;
  dataUpdatedAt: number;
}

function timeAgo(ts: number, now: number): string {
  if (!ts) return "—";
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
}

export function StatsBar({ stats, isFetching, dataUpdatedAt }: Props) {
  // Re-render every 30s so the "updated N min ago" label stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
      <Stat label="Total" value={stats.total} color="#e2e8f0" />
      <Divider />
      <Stat label="Active" value={stats.active} color="#34d399" />
      <Divider />
      <Stat label="Closed" value={stats.closed} color="#94a3b8" />
      <Divider />
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (isFetching ? "animate-pulse bg-sky-400" : "bg-emerald-400")
          }
        />
        {isFetching ? "updating…" : `updated ${timeAgo(dataUpdatedAt, now)}`}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center leading-tight">
      <div className="text-base font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-white/10" />;
}
