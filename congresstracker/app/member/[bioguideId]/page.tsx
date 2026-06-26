import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getMember, getMemberTerms } from "../../../lib/queries.ts";
import {
  PARTY_LABELS,
  CHAMBER_LABELS,
  congressStartYear,
} from "../../../lib/constants.ts";
import { PartyBadge } from "../../_components/PartyBadge.tsx";
import { MemberPhoto } from "../../_components/MemberPhoto.tsx";
import type { Term } from "../../../lib/database.types.ts";

export const revalidate = 3600;

interface PageProps {
  params: { bioguideId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const member = await getMember(params.bioguideId);
  if (!member) return { title: "Member not found" };
  return {
    title: member.full_name,
    description: `Congressional record for ${member.full_name} (${member.party ?? "?"}-${member.state ?? "?"}).`,
  };
}

export default async function MemberProfilePage({ params }: PageProps) {
  const [member, terms] = await Promise.all([
    getMember(params.bioguideId),
    getMemberTerms(params.bioguideId),
  ]);

  if (!member) notFound();

  const partyLabel = member.party ? PARTY_LABELS[member.party] : null;
  const chamberLabel = member.current_chamber
    ? CHAMBER_LABELS[member.current_chamber]
    : null;

  // Group terms by chamber for display.
  const houseTerms = terms.filter((t) => t.chamber === "house");
  const senateTerms = terms.filter((t) => t.chamber === "senate");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-6"
      >
        ← All members
      </Link>

      {/* Member header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex gap-6 items-start">
        <MemberPhoto src={member.image_url} name={member.full_name} size={96} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{member.full_name}</h1>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {member.party && <PartyBadge party={member.party} />}
            {member.state && (
              <span className="text-sm text-gray-600">{member.state}</span>
            )}
            {chamberLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {chamberLabel}
              </span>
            )}
          </div>

          {partyLabel && (
            <p className="mt-2 text-sm text-gray-500">
              Party: {partyLabel}
            </p>
          )}

          {member.congress_url && (
            <a
              href={member.congress_url.replace("api.congress.gov/v3", "www.congress.gov")}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              View on congress.gov ↗
            </a>
          )}
        </div>
      </div>

      {/* Terms served */}
      {terms.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Terms served</h2>

          {senateTerms.length > 0 && (
            <TermsTable title="Senate" terms={senateTerms} />
          )}
          {houseTerms.length > 0 && (
            <TermsTable
              title="House of Representatives"
              terms={houseTerms}
              showDistrict
            />
          )}
        </section>
      ) : (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          No term data available yet.
        </div>
      )}

      {/* Placeholder sections for future phases */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Voting record</h2>
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Vote data will appear here after Phase 6 (votes ingestion).
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Promises &amp; record</h2>
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Promise tracking will appear here after Phase 8 (promises review tool).
          Every promise status is human-reviewed and source-linked.
        </div>
      </section>

      {/* Source note */}
      <p className="mt-8 text-xs text-gray-400">
        Member data sourced from{" "}
        <a
          href="https://api.congress.gov"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-gray-600"
        >
          api.congress.gov
        </a>
        .{" "}
        {member.source_updated_at && (
          <>
            Last synced:{" "}
            {new Date(member.source_updated_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TermsTable({
  title,
  terms,
  showDistrict = false,
}: {
  title: string;
  terms: Term[];
  showDistrict?: boolean;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2 text-left font-medium text-gray-600">Congress</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Years</th>
              {showDistrict && (
                <th className="px-4 py-2 text-left font-medium text-gray-600">District</th>
              )}
              <th className="px-4 py-2 text-left font-medium text-gray-600">State</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Party</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {terms.map((t) => {
              const startYear = t.start_year ?? congressStartYear(t.congress);
              const endYear = t.end_year ?? startYear + 2;
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-mono text-gray-700">
                    {t.congress}th
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {startYear}–{endYear}
                  </td>
                  {showDistrict && (
                    <td className="px-4 py-2 text-gray-600">
                      {t.district != null ? `District ${t.district}` : "At Large"}
                    </td>
                  )}
                  <td className="px-4 py-2 text-gray-600">{t.state ?? "—"}</td>
                  <td className="px-4 py-2">
                    <PartyBadge party={t.party} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
