"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMembersByWing, type WingColumn } from "../../lib/queries.ts";
import {
  US_STATES,
  CHAMBER_LABELS,
  WING_LABELS,
} from "../../lib/constants.ts";
import type { Wing } from "../../lib/database.types.ts";
import { useAsync } from "../_components/useAsync.ts";
import { PartyBadge } from "../_components/PartyBadge.tsx";
import { MemberPhoto } from "../_components/MemberPhoto.tsx";

// Column accents are neutral (sky / stone / rose), deliberately not party
// blue/red — the wing is a sourced ideology bucket, not a partisan label.
const COLUMN: Record<Wing, { ring: string; head: string }> = {
  left: { ring: "border-sky-200", head: "text-sky-700" },
  center: { ring: "border-stone-200", head: "text-stone-700" },
  right: { ring: "border-rose-200", head: "text-rose-700" },
};

const EMPTY = {
  left: { members: [], total: 0 },
  center: { members: [], total: 0 },
  right: { members: [], total: 0 },
};

export function WingsBrowser() {
  const sp = useSearchParams();
  const router = useRouter();
  const filters = {
    chamber: sp.get("chamber") ?? undefined,
    state: sp.get("state") ?? undefined,
  };

  const { data: browse, loading } = useAsync(
    () => getMembersByWing(filters),
    [sp.toString()],
    EMPTY,
  );
  const grandTotal =
    browse.left.total + browse.center.total + browse.right.total;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const chamber = String(fd.get("chamber") ?? "");
    const state = String(fd.get("state") ?? "");
    if (chamber) params.set("chamber", chamber);
    if (state) params.set("state", state);
    const qs = params.toString();
    router.push(qs ? `/wings?${qs}` : "/wings");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Left / Center / Right
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          The same Congress, viewed through each lens. Wings come from a
          published ideology metric, not our opinion —{" "}
          <Link href="/methodology" className="underline hover:text-gray-700">
            how this works
          </Link>
          .
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="my-6 flex flex-wrap gap-3 items-center"
      >
        <select
          name="chamber"
          defaultValue={filters.chamber ?? ""}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
          aria-label="Filter by chamber"
        >
          <option value="">All chambers</option>
          <option value="house">House</option>
          <option value="senate">Senate</option>
        </select>
        <select
          name="state"
          defaultValue={filters.state ?? ""}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Apply
        </button>
        {(filters.chamber || filters.state) && (
          <Link href="/wings" className="text-xs text-blue-600 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          Loading…
        </div>
      ) : grandTotal === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 font-medium">
            No classified members to show yet.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Wings appear once the alignment-scores ingestion (
            <code className="font-mono text-xs bg-gray-100 px-1 rounded">
              ingest/scores.ts
            </code>
            ) has run.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(["left", "center", "right"] as Wing[]).map((w) => (
            <WingColumnView
              key={w}
              wing={w}
              column={browse[w]}
              filters={filters}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WingColumnView({
  wing,
  column,
  filters,
}: {
  wing: Wing;
  column: WingColumn;
  filters: { chamber?: string; state?: string };
}) {
  const style = COLUMN[wing];
  const params = new URLSearchParams({ wing });
  if (filters.chamber) params.set("chamber", filters.chamber);
  if (filters.state) params.set("state", filters.state);
  const seeAllHref = `/?${params.toString()}`;

  return (
    <section
      className={`rounded-lg border ${style.ring} bg-white shadow-sm flex flex-col`}
      aria-label={`${WING_LABELS[wing]} members`}
    >
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-gray-100">
        <h2 className={`font-semibold ${style.head}`}>{WING_LABELS[wing]}</h2>
        <span className="text-xs text-gray-400">{column.total} members</span>
      </div>

      {column.members.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-400">
          None match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {column.members.map((m) => (
            <li key={m.bioguide_id}>
              <Link
                href={`/member/${m.bioguide_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <MemberPhoto src={m.image_url} name={m.full_name} size={28} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {m.full_name}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {m.state ?? "—"}
                    {m.current_chamber
                      ? ` · ${CHAMBER_LABELS[m.current_chamber]}`
                      : ""}
                  </span>
                </span>
                <PartyBadge party={m.party} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {column.total > column.members.length && (
        <Link
          href={seeAllHref}
          className="mt-auto border-t border-gray-100 px-4 py-3 text-sm text-blue-600 hover:bg-gray-50"
        >
          See all {column.total} →
        </Link>
      )}
    </section>
  );
}
