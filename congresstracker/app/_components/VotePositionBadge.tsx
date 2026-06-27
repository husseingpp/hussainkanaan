import type { VotePosition } from "../../lib/database.types.ts";

const STYLES: Record<VotePosition, { label: string; cls: string }> = {
  yea: { label: "Yea", cls: "bg-green-100 text-green-800" },
  nay: { label: "Nay", cls: "bg-red-100 text-red-800" },
  present: { label: "Present", cls: "bg-yellow-100 text-yellow-800" },
  not_voting: { label: "Not voting", cls: "bg-gray-100 text-gray-500" },
};

export function VotePositionBadge({ position }: { position: VotePosition }) {
  const { label, cls } = STYLES[position];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
