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
  hidden: Set<string>;
  onToggle: (category: string) => void;
}

export function Legend({ className = "", hidden, onToggle }: Props) {
  const entries = Object.entries(CATEGORY_COLORS);
  return (
    <div className={"cyber-panel max-w-[11rem] rounded-xl p-3 " + className}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
        Categories
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {entries.map(([id, color]) => {
          const off = hidden.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onToggle(id)}
                title={off ? "Show" : "Hide"}
                className={
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-cyan-400/10 " +
                  (off ? "text-cyan-100/35 line-through" : "text-cyan-100/85")
                }
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={
                    off
                      ? { backgroundColor: "transparent", border: `1px solid ${color}` }
                      : { backgroundColor: color, boxShadow: `0 0 6px ${color}` }
                  }
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
