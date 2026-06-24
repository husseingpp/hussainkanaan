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
    <div className="cyber-panel flex items-center gap-3 rounded-xl px-3 py-2">
      <Stat label="Total" value={stats.total} color="#eafdff" />
      <Divider />
      <Stat label="Active" value={stats.active} color="#00eaff" />
      <Divider />
      <Stat label="Closed" value={stats.closed} color="#ff2bd6" />
      <Divider />
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-cyan-200/70">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (isFetching
              ? "animate-pulse bg-fuchsia-400 shadow-[0_0_8px_rgba(255,43,214,0.8)]"
              : "bg-cyan-400 shadow-[0_0_8px_rgba(0,234,255,0.8)]")
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
      <div className="text-[10px] uppercase tracking-wide text-cyan-200/60">{label}</div>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-cyan-400/20" />;
}
