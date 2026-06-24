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
    <aside className="cyber-panel absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto p-5 sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-100"
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
          className="rounded-lg p-1 text-cyan-300/70 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <h2 className="text-lg font-semibold leading-snug text-cyan-50">{point.title}</h2>

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <Row label="Status">
          <span className={point.closed ? "text-fuchsia-300" : "text-cyan-300"}>
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
            className="cyber-glow-cyan inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/70 bg-cyan-500/15 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-500/30"
          >
            View source ↗
          </a>
        )}
        <a
          href={point.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-400/40 px-4 py-2 text-sm uppercase tracking-wider text-fuchsia-200 transition-colors hover:bg-fuchsia-500/15"
        >
          Open on EONET ↗
        </a>
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-cyan-400/10 pb-2">
      <dt className="uppercase tracking-wide text-cyan-200/60">{label}</dt>
      <dd className="text-right font-medium text-cyan-50">{children}</dd>
    </div>
  );
}
