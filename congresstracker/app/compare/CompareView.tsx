"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getMember,
  getMemberAlignment,
  getMemberStats,
  getMemberVotes,
  getMemberPromises,
  getMemberOptions,
  type MemberOption,
} from "../../lib/queries.ts";
import { PARTY_LABELS, CHAMBER_LABELS } from "../../lib/constants.ts";
import { tallyVotes, tallyPromises, pct } from "../../lib/wings.ts";
import { useAsync } from "../_components/useAsync.ts";
import { PartyBadge } from "../_components/PartyBadge.tsx";
import { WingBadge } from "../_components/WingBadge.tsx";
import { MemberPhoto } from "../_components/MemberPhoto.tsx";
import type { Member, AlignmentScore } from "../../lib/database.types.ts";

interface MemberSnapshot {
  member: Member;
  alignment: AlignmentScore | null;
  stats: { sponsored: number; cosponsored: number; votes: number };
  votes: Record<string, number>;
  promises: Record<string, number>;
  promiseTotal: number;
  voteSample: number;
}

async function snapshot(bioguideId: string): Promise<MemberSnapshot | null> {
  const member = await getMember(bioguideId);
  if (!member) return null;
  const [alignment, stats, votes, promises] = await Promise.all([
    getMemberAlignment(bioguideId),
    getMemberStats(bioguideId),
    getMemberVotes(bioguideId, 1000),
    getMemberPromises(bioguideId),
  ]);
  return {
    member,
    alignment,
    stats,
    votes: tallyVotes(votes),
    promises: tallyPromises(promises),
    promiseTotal: promises.length,
    voteSample: votes.length,
  };
}

interface CompareData {
  options: MemberOption[];
  a: MemberSnapshot | null;
  b: MemberSnapshot | null;
}

export function CompareView() {
  const sp = useSearchParams();
  const router = useRouter();
  const aId = sp.get("a")?.trim() || undefined;
  const bId = sp.get("b")?.trim() || undefined;

  const { data, loading } = useAsync<CompareData>(
    async () => {
      const [options, a, b] = await Promise.all([
        getMemberOptions(),
        aId ? snapshot(aId) : Promise.resolve(null),
        bId ? snapshot(bId) : Promise.resolve(null),
      ]);
      return { options, a, b };
    },
    [sp.toString()],
    { options: [], a: null, b: null },
  );
  const { options, a, b } = data;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const av = String(fd.get("a") ?? "");
    const bv = String(fd.get("b") ?? "");
    if (av) params.set("a", av);
    if (bv) params.set("b", bv);
    const qs = params.toString();
    router.push(qs ? `/compare?${qs}` : "/compare");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Compare members</h1>
      <p className="mt-1 text-sm text-gray-500">
        Two records, side by side. Every figure comes from the same sourced data
        shown on each member&apos;s profile.
      </p>

      <form
        onSubmit={onSubmit}
        className="my-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end"
      >
        <MemberSelect name="a" label="First member" value={aId} options={options} />
        <MemberSelect name="b" label="Second member" value={bId} options={options} />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Compare
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          {options.length === 0 && (
            <p className="text-sm text-gray-400">
              No members in the database yet — run the members ingestion first.
            </p>
          )}

          {aId && !a && <NotFound id={aId} />}
          {bId && !b && <NotFound id={bId} />}

          {a && b ? (
            <ComparisonTable a={a} b={b} />
          ) : (
            options.length > 0 && (
              <p className="text-sm text-gray-400">
                Pick two members above to see them side by side.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <p className="mb-3 text-sm text-red-600">
      No member found for <code className="font-mono">{id}</code>.
    </p>
  );
}

function MemberSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: Array<{ bioguide_id: string; full_name: string; state: string | null }>;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        key={value ?? ""}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.bioguide_id} value={o.bioguide_id}>
            {o.full_name}
            {o.state ? ` (${o.state})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonTable({ a, b }: { a: MemberSnapshot; b: MemberSnapshot }) {
  const rows: Array<{ label: string; a: React.ReactNode; b: React.ReactNode }> = [
    {
      label: "Party",
      a: <PartyBadge party={a.member.party} />,
      b: <PartyBadge party={b.member.party} />,
    },
    {
      label: "State",
      a: a.member.state ?? "—",
      b: b.member.state ?? "—",
    },
    {
      label: "Chamber",
      a: a.member.current_chamber ? CHAMBER_LABELS[a.member.current_chamber] : "—",
      b: b.member.current_chamber ? CHAMBER_LABELS[b.member.current_chamber] : "—",
    },
    {
      label: "Wing",
      a: <WingCell snap={a} />,
      b: <WingCell snap={b} />,
    },
    {
      label: "Bills sponsored",
      a: a.stats.sponsored,
      b: b.stats.sponsored,
    },
    {
      label: "Bills cosponsored",
      a: a.stats.cosponsored,
      b: b.stats.cosponsored,
    },
    {
      label: "Roll-call votes recorded",
      a: a.stats.votes,
      b: b.stats.votes,
    },
    {
      label: "Yea / Nay (recent)",
      a: <VoteSplit snap={a} />,
      b: <VoteSplit snap={b} />,
    },
    {
      label: "Promises tracked",
      a: <PromiseCell snap={a} />,
      b: <PromiseCell snap={b} />,
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Side-by-side comparison of {a.member.full_name} and {b.member.full_name}
        </caption>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500 w-40">
              Metric
            </th>
            <MemberHeader member={a.member} />
            <MemberHeader member={b.member} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-4 py-3 text-left font-medium text-gray-500">
                {r.label}
              </th>
              <td className="px-4 py-3 text-gray-800">{r.a}</td>
              <td className="px-4 py-3 text-gray-800">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberHeader({ member }: { member: Member }) {
  return (
    <th scope="col" className="px-4 py-3 text-left">
      <Link
        href={`/member/${member.bioguide_id}`}
        className="flex items-center gap-2 hover:text-blue-700"
      >
        <MemberPhoto src={member.image_url} name={member.full_name} size={28} />
        <span className="font-semibold">{member.full_name}</span>
      </Link>
    </th>
  );
}

function WingCell({ snap }: { snap: MemberSnapshot }) {
  if (!snap.alignment) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <WingBadge wing={snap.alignment.wing} />
      {snap.alignment.dimension1 != null && (
        <span className="font-mono text-xs text-gray-500">
          {Number(snap.alignment.dimension1).toFixed(2)}
        </span>
      )}
    </span>
  );
}

function VoteSplit({ snap }: { snap: MemberSnapshot }) {
  const decided = snap.votes.yea + snap.votes.nay;
  if (snap.voteSample === 0) return <span className="text-gray-400">—</span>;
  return (
    <span>
      {snap.votes.yea} / {snap.votes.nay}
      {decided > 0 && (
        <span className="text-xs text-gray-400">
          {" "}
          ({pct(snap.votes.yea, decided)}% yea)
        </span>
      )}
    </span>
  );
}

function PromiseCell({ snap }: { snap: MemberSnapshot }) {
  if (snap.promiseTotal === 0) return <span className="text-gray-400">none</span>;
  const { kept, broken, partial } = snap.promises;
  return (
    <span>
      {snap.promiseTotal}
      <span className="text-xs text-gray-400">
        {" "}
        ({kept} kept · {partial} partial · {broken} broken)
      </span>
    </span>
  );
}
