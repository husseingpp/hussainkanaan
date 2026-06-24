import { useEffect, useRef, useState } from "react";
import { useCategories } from "../hooks/useCategories";
import type { StatusFilter } from "../lib/transform";

interface Props {
  hidden: Set<string>;
  status: StatusFilter;
  visibleCount: number;
  onToggleCategory: (id: string) => void;
  onSetHidden: (hidden: Set<string>) => void;
  onStatus: (status: StatusFilter) => void;
  onReset: () => void;
}

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Active" },
  { value: "closed", label: "Closed" },
];

export function FilterBar({
  hidden,
  status,
  visibleCount,
  onToggleCategory,
  onSetHidden,
  onStatus,
  onReset,
}: Props) {
  const { data: categories } = useCategories();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const total = categories?.length ?? 0;
  const shownCats = total - (categories ?? []).filter((c) => hidden.has(c.id)).length;
  const isDefault = hidden.size === 0 && status === "open";

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="cyber-panel flex flex-wrap items-center gap-2 rounded-xl p-2">
      {/* Category multi-select */}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/5 px-3 py-1.5 text-sm text-cyan-100 transition-colors hover:bg-cyan-500/15"
        >
          Categories
          <span className="text-xs text-cyan-300/70">
            {total ? `${shownCats}/${total}` : "…"}
          </span>
          <span className="text-[10px]">▾</span>
        </button>

        {open && categories && (
          <div className="absolute left-0 top-full z-30 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-cyan-400/30 bg-slate-950/95 p-2 shadow-[0_0_24px_rgba(0,234,255,0.25)] backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => onSetHidden(new Set())}
                className="rounded px-2 py-0.5 text-xs uppercase tracking-wide text-cyan-300 hover:bg-cyan-400/10"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onSetHidden(new Set(categories.map((c) => c.id)))}
                className="rounded px-2 py-0.5 text-xs uppercase tracking-wide text-fuchsia-300 hover:bg-fuchsia-400/10"
              >
                None
              </button>
            </div>
            {categories.map((c) => {
              const checked = !hidden.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-cyan-100/90 hover:bg-cyan-400/10"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(c.id)}
                    className="h-3.5 w-3.5 accent-cyan-400"
                  />
                  {c.title}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Status toggle */}
      <div className="flex overflow-hidden rounded-lg border border-cyan-400/30">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onStatus(s.value)}
            className={
              "px-3 py-1.5 text-sm uppercase tracking-wide transition-colors " +
              (s.value === status
                ? "bg-cyan-400/90 font-semibold text-black shadow-[0_0_12px_rgba(0,234,255,0.6)]"
                : "bg-cyan-500/5 text-cyan-200/80 hover:bg-cyan-500/15")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className="px-1 text-xs uppercase tracking-wider text-fuchsia-300/80">
        {visibleCount} shown
      </span>

      {!isDefault && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg px-2 py-1 text-xs uppercase tracking-wide text-cyan-300/80 underline-offset-2 hover:text-cyan-200 hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
