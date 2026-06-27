import type { Wing } from "../../lib/database.types.ts";
import { WING_LABELS } from "../../lib/constants.ts";

// Descriptive, never pejorative. Neutral slate/stone palette deliberately
// avoids party colours (blue/red), so the wing reads as a sourced ideology
// bucket rather than a partisan label.
const STYLES: Record<Wing, string> = {
  left: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  center: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
  right: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export function WingBadge({ wing }: { wing: Wing | null }) {
  if (!wing) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[wing]}`}
      title="Wing is a bucket of the DW-NOMINATE ideology score — see Methodology"
    >
      {WING_LABELS[wing]}
    </span>
  );
}
