import type { PromiseStatus } from "../../lib/database.types.ts";
import { PROMISE_STATUS_LABELS } from "../../lib/constants.ts";

// Neutral, non-pejorative styling. "Broken" is the defamation-sensitive state;
// it reads as a sober factual label, not an accusation, and is only ever shown
// when a reviewer has attached a source (enforced by the schema).
const STYLES: Record<PromiseStatus, string> = {
  unverified: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  kept: "bg-green-50 text-green-700 ring-1 ring-green-200",
  partial: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  stalled: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  broken: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[status]}`}
    >
      {PROMISE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
