import type { Party } from "../../lib/database.types.ts";
import { PARTY_LABELS } from "../../lib/constants.ts";

const COLORS: Record<string, string> = {
  D: "bg-blue-100 text-blue-800",
  R: "bg-red-100 text-red-800",
  I: "bg-purple-100 text-purple-800",
  ID: "bg-purple-100 text-purple-800",
  L: "bg-amber-100 text-amber-800",
  Other: "bg-gray-100 text-gray-700",
};

export function PartyBadge({ party }: { party: Party | null }) {
  if (!party) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COLORS[party] ?? "bg-gray-100 text-gray-700"}`}
      title={PARTY_LABELS[party]}
    >
      {party}
    </span>
  );
}
