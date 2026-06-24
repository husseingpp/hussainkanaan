import { CATEGORY_COLORS } from "../lib/transform";

// Human-friendly labels for the EONET category ids used in CATEGORY_COLORS.
const LABELS: Record<string, string> = {
  drought: "Drought",
  dustHaze: "Dust & Haze",
  earthquakes: "Earthquakes",
  floods: "Floods",
  landslides: "Landslides",
  manmade: "Manmade",
  seaLakeIce: "Sea & Lake Ice",
  severeStorms: "Severe Storms",
  snow: "Snow",
  tempExtremes: "Temp Extremes",
  volcanoes: "Volcanoes",
  wildfires: "Wildfires",
  waterColor: "Water Color",
};

interface Props {
  className?: string;
  activeCategory: string;
  onSelect: (category: string) => void;
}

export function Legend({ className = "", activeCategory, onSelect }: Props) {
  const entries = Object.entries(CATEGORY_COLORS);
  return (
    <div className={"cyber-panel max-w-[11rem] rounded-xl p-3 " + className}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
        Categories
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {entries.map(([id, color]) => {
          const active = activeCategory === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(active ? "" : id)}
                className={
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors " +
                  (active
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-cyan-100/70 hover:bg-cyan-400/10")
                }
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                />
                <span className="truncate">{LABELS[id] ?? id}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
