import type { ReactNode } from "react";
import type { GlobePoint } from "../lib/transform";

interface Props {
  point: GlobePoint;
  onClose: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatCoord(value: number, positive: string, negative: string): string {
  const dir = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(3)}° ${dir}`;
}

export function EventPanel({ point, onClose }: Props) {
  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-white/10 bg-slate-950/85 p-5 backdrop-blur-md sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-2xl sm:border">
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: point.color }}
          />
          {point.categoryTitle}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <h2 className="text-lg font-semibold leading-snug text-white">{point.title}</h2>

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <Row label="Status">
          <span className={point.closed ? "text-slate-400" : "text-emerald-400"}>
            {point.closed ? "Closed" : "Active"}
          </span>
        </Row>
        <Row label="Most recent">{formatDate(point.date)}</Row>
        <Row label="Coordinates">
          {formatCoord(point.lat, "N", "S")}, {formatCoord(point.lng, "E", "W")}
        </Row>
      </dl>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {point.sourceUrl && (
          <a
            href={point.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400"
          >
            View source ↗
          </a>
        )}
        <a
          href={point.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10"
        >
          Open on EONET ↗
        </a>
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-100">{children}</dd>
    </div>
  );
}
