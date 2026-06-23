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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md">
      <select
        aria-label="Filter by category"
        value={category}
        onChange={(e) => onCategory(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400/60"
      >
        <option value="">All categories</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      <div className="flex overflow-hidden rounded-lg border border-white/10">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onStatus(s.value)}
            className={
              "px-3 py-1.5 text-sm transition-colors " +
              (s.value === status
                ? "bg-sky-500/80 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className="px-1 text-xs text-slate-400">{visibleCount} shown</span>

      {!isDefault && (
        <button
          type="button"
          onClick={() => {
            onCategory("");
            onStatus("open");
          }}
          className="rounded-lg px-2 py-1 text-xs text-slate-300 underline-offset-2 hover:text-white hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
