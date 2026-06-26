import Link from "next/link";
import { getMembers, PER_PAGE } from "../lib/queries.ts";
import { US_STATES, CHAMBER_LABELS, PARTY_LABELS } from "../lib/constants.ts";
import { PartyBadge } from "./_components/PartyBadge.tsx";
import { MemberPhoto } from "./_components/MemberPhoto.tsx";

export const revalidate = 3600; // re-fetch at most once per hour

// Next.js 14 App Router passes searchParams as a plain object to page components.
interface PageProps {
  searchParams: {
    chamber?: string;
    party?: string;
    state?: string;
    q?: string;
    page?: string;
  };
}

export default async function MemberListPage({ searchParams }: PageProps) {
  const filters = {
    chamber: searchParams.chamber,
    party: searchParams.party,
    state: searchParams.state,
    q: searchParams.q,
    page: searchParams.page,
  };

  const { members, total, page } = await getMembers(filters);
  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilters = !!(filters.chamber || filters.party || filters.state || filters.q);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Members of Congress</h1>
        <p className="mt-1 text-sm text-gray-500">
          {total > 0
            ? `${total.toLocaleString()} member${total === 1 ? "" : "s"} — every factual record is source-linked`
            : "Every factual record is source-linked"}
        </p>
      </div>

      {/* Filter form — plain GET, works without JavaScript */}
      <form
        method="GET"
        action="/"
        className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <select
          name="chamber"
          defaultValue={filters.chamber ?? ""}
          className="col-span-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          aria-label="Filter by chamber"
        >
          <option value="">All chambers</option>
          <option value="house">House</option>
          <option value="senate">Senate</option>
        </select>

        <select
          name="party"
          defaultValue={filters.party ?? ""}
          className="col-span-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          aria-label="Filter by party"
        >
          <option value="">All parties</option>
          {Object.entries(PARTY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label} ({code})
            </option>
          ))}
        </select>

        <select
          name="state"
          defaultValue={filters.state ?? ""}
          className="col-span-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="col-span-2 sm:col-span-1 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search name…"
            maxLength={100}
            className="flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            aria-label="Search by member name"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filter
          </button>
        </div>

        {hasFilters && (
          <div className="col-span-2 sm:col-span-4 flex items-center gap-2">
            <span className="text-xs text-gray-500">Active filters:</span>
            {filters.chamber && (
              <FilterChip label={CHAMBER_LABELS[filters.chamber] ?? filters.chamber} />
            )}
            {filters.party && (
              <FilterChip label={PARTY_LABELS[filters.party] ?? filters.party} />
            )}
            {filters.state && <FilterChip label={filters.state} />}
            {filters.q && <FilterChip label={`"${filters.q}"`} />}
            <Link href="/" className="ml-auto text-xs text-blue-600 hover:underline">
              Clear all
            </Link>
          </div>
        )}
      </form>

      {/* Results */}
      {members.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-10" aria-label="Photo" />
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">State</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Chamber</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Party</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.bioguide_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <MemberPhoto src={m.image_url} name={m.full_name} size={32} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/member/${m.bioguide_id}`}
                        className="font-medium text-gray-900 hover:text-blue-700"
                      >
                        {m.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {m.state ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {m.current_chamber
                        ? CHAMBER_LABELS[m.current_chamber]
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PartyBadge party={m.party} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              filters={filters}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components (used only on this page)
// ---------------------------------------------------------------------------

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">
      {label}
    </span>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <p className="text-gray-500 font-medium">
        {hasFilters ? "No members match these filters." : "No members in the database yet."}
      </p>
      {!hasFilters && (
        <p className="mt-2 text-sm text-gray-400">
          Run the ingestion job ({" "}
          <code className="font-mono text-xs bg-gray-100 px-1 rounded">
            ingest/members.ts
          </code>
          {" "}) to populate member data.
        </p>
      )}
      {hasFilters && (
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}

function buildFilterUrl(
  page: number,
  filters: { chamber?: string; party?: string; state?: string; q?: string },
): string {
  const params = new URLSearchParams();
  if (filters.chamber) params.set("chamber", filters.chamber);
  if (filters.party) params.set("party", filters.party);
  if (filters.state) params.set("state", filters.state);
  if (filters.q) params.set("q", filters.q);
  if (page > 0) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function Pagination({
  page,
  totalPages,
  filters,
}: {
  page: number;
  totalPages: number;
  filters: { chamber?: string; party?: string; state?: string; q?: string };
}) {
  return (
    <nav
      className="mt-4 flex items-center justify-between"
      aria-label="Pagination"
    >
      <p className="text-sm text-gray-500">
        Page {page + 1} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 0 && (
          <Link
            href={buildFilterUrl(page - 1, filters)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Previous
          </Link>
        )}
        {page + 1 < totalPages && (
          <Link
            href={buildFilterUrl(page + 1, filters)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
