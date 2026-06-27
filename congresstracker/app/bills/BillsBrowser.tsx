"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getBills, PER_PAGE } from "../../lib/queries.ts";
import { BILL_TYPE_LABELS } from "../../lib/constants.ts";
import { useAsync } from "../_components/useAsync.ts";
import { BillStatusBadge } from "../_components/BillStatusBadge.tsx";

interface Filters {
  congress?: string;
  status?: string;
  q?: string;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BillsBrowser() {
  const sp = useSearchParams();
  const router = useRouter();

  const filters = {
    congress: sp.get("congress") ?? undefined,
    status: sp.get("status") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
  };

  const { data, loading } = useAsync(
    () => getBills(filters),
    [sp.toString()],
    { bills: [], total: 0, page: 0 },
  );
  const { bills, total, page } = data;
  const totalPages = Math.ceil(total / PER_PAGE);
  const hasFilters = !!(filters.congress || filters.status || filters.q);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    router.push(
      buildUrl(0, {
        congress: String(fd.get("congress") ?? ""),
        status: String(fd.get("status") ?? ""),
        q: String(fd.get("q") ?? ""),
      }),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
        <p className="mt-1 text-sm text-gray-500">
          {total > 0
            ? `${total.toLocaleString()} bill${total === 1 ? "" : "s"} — sourced from congress.gov`
            : "Sourced from congress.gov"}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <input
          type="number"
          name="congress"
          defaultValue={filters.congress ?? ""}
          placeholder="Congress (e.g. 118)"
          min={1}
          max={200}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          aria-label="Filter by congress number"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="law">Became law</option>
        </select>
        <div className="col-span-2 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search title…"
            maxLength={120}
            className="flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            aria-label="Search by bill title"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filter
          </button>
        </div>
        {hasFilters && (
          <div className="col-span-2 sm:col-span-4">
            <Link href="/bills" className="text-xs text-blue-600 hover:underline">
              Clear filters
            </Link>
          </div>
        )}
      </form>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          Loading bills…
        </div>
      ) : bills.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 font-medium">
            {hasFilters ? "No bills match these filters." : "No bills in the database yet."}
          </p>
          {!hasFilters && (
            <p className="mt-2 text-sm text-gray-400">
              Run the ingestion job (
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                ingest/bills.ts
              </code>
              ) to populate bill data.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Bill</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell whitespace-nowrap">Latest action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                      <Link href={`/bill/${b.id}`} className="hover:text-blue-700">
                        {BILL_TYPE_LABELS[b.bill_type] ?? b.bill_type.toUpperCase()} {b.number}
                      </Link>
                      <span className="text-gray-400"> · {b.congress}th</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bill/${b.id}`}
                        className="text-gray-900 hover:text-blue-700 line-clamp-2"
                      >
                        {b.title ?? "(untitled)"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell whitespace-nowrap">
                      {formatDate(b.latest_action_date)}
                    </td>
                    <td className="px-4 py-3">
                      <BillStatusBadge becameLaw={b.became_law} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
              <p className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 0 && (
                  <Link
                    href={buildUrl(page - 1, filters)}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {page + 1 < totalPages && (
                  <Link
                    href={buildUrl(page + 1, filters)}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function buildUrl(page: number, filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.congress) params.set("congress", filters.congress);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (page > 0) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/bills?${qs}` : "/bills";
}
