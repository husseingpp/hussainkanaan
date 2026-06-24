import { useCategories } from "../hooks/useCategories";
import type { StatusFilter } from "../lib/transform";

interface Props {
  category: string;
  status: StatusFilter;
  visibleCount: number;
  onCategory: (category: string) => void;
  onStatus: (status: StatusFilter) => void;
}

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Active" },
  { value: "closed", label: "Closed" },
];

export function FilterBar({ category, status, visibleCount, onCategory, onStatus }: Props) {
  const { data: categories } = useCategories();
  const isDefault = !category && status === "open";

  return (
    <div className="cyber-panel flex flex-wrap items-center gap-2 rounded-xl p-2">
      <select
        aria-label="Filter by category"
        value={category}
        onChange={(e) => onCategory(e.target.value)}
        className="rounded-lg border border-cyan-400/30 bg-cyan-500/5 px-3 py-1.5 text-sm text-cyan-100 outline-none focus:border-cyan-400/80"
      >
        <option value="">All categories</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

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
          onClick={() => {
            onCategory("");
            onStatus("open");
          }}
          className="rounded-lg px-2 py-1 text-xs uppercase tracking-wide text-cyan-300/80 underline-offset-2 hover:text-cyan-200 hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
