import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getBill,
  getBillSponsorships,
  type SponsorshipWithMember,
} from "../../../lib/queries.ts";
import {
  BILL_TYPE_LABELS,
  congressGovBillUrl,
  ordinal,
} from "../../../lib/constants.ts";
import { BillStatusBadge } from "../../_components/BillStatusBadge.tsx";
import { PartyBadge } from "../../_components/PartyBadge.tsx";
import { MemberPhoto } from "../../_components/MemberPhoto.tsx";

export const revalidate = 3600;

interface PageProps {
  params: { id: string };
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const bill = await getBill(params.id);
  if (!bill) return { title: "Bill not found" };
  const label = BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type.toUpperCase();
  return {
    title: `${label} ${bill.number} (${bill.congress}th)`,
    description: bill.title ?? undefined,
  };
}

export default async function BillProfilePage({ params }: PageProps) {
  const bill = await getBill(params.id);
  if (!bill) notFound();

  const sponsorships = await getBillSponsorships(bill.id);
  const primary = sponsorships.filter((s) => s.is_sponsor);
  const cosponsors = sponsorships.filter((s) => !s.is_sponsor);

  const label = BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type.toUpperCase();
  const webUrl =
    congressGovBillUrl(bill.congress, bill.bill_type, bill.number) ??
    bill.congress_url;
  const introduced = formatDate(bill.introduced_date);
  const latestActionDate = formatDate(bill.latest_action_date);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <Link
        href="/bills"
        className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-6"
      >
        ← All bills
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm text-gray-500">
            {label} {bill.number} · {ordinal(bill.congress)} Congress
          </span>
          <BillStatusBadge becameLaw={bill.became_law} />
          {bill.policy_area && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {bill.policy_area}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {bill.title ?? "(untitled bill)"}
        </h1>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {introduced && (
            <div className="flex gap-2">
              <dt className="text-gray-500">Introduced:</dt>
              <dd className="text-gray-900">{introduced}</dd>
            </div>
          )}
          {latestActionDate && (
            <div className="flex gap-2">
              <dt className="text-gray-500">Latest action:</dt>
              <dd className="text-gray-900">{latestActionDate}</dd>
            </div>
          )}
        </dl>

        {bill.latest_action && (
          <p className="mt-3 text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            {bill.latest_action}
          </p>
        )}

        {webUrl && (
          <a
            href={webUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            View full text &amp; history on congress.gov ↗
          </a>
        )}
      </div>

      {/* Sponsors */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">
          Sponsor{primary.length === 1 ? "" : "s"}
        </h2>
        {primary.length > 0 ? (
          <div className="space-y-2">
            {primary.map((s) => (
              <SponsorRow key={`p-${s.bioguide_id}`} sponsorship={s} primary />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No sponsor data available yet.
          </p>
        )}
      </section>

      {cosponsors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-3">
            Cosponsors ({cosponsors.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cosponsors.map((s) => (
              <SponsorRow key={`c-${s.bioguide_id}`} sponsorship={s} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Bill data sourced from{" "}
        <a
          href="https://api.congress.gov"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-gray-600"
        >
          api.congress.gov
        </a>
        .
      </p>
    </div>
  );
}

function SponsorRow({
  sponsorship,
  primary = false,
}: {
  sponsorship: SponsorshipWithMember;
  primary?: boolean;
}) {
  const m = sponsorship.members;
  if (!m) {
    // Member not in our table (e.g. a former member not yet ingested).
    return (
      <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white p-2 text-sm text-gray-400">
        Unknown member ({sponsorship.bioguide_id})
      </div>
    );
  }
  return (
    <Link
      href={`/member/${m.bioguide_id}`}
      className={`flex items-center gap-3 rounded-md border bg-white p-2 hover:bg-gray-50 transition-colors ${
        primary ? "border-gray-300" : "border-gray-100"
      }`}
    >
      <MemberPhoto src={m.image_url} name={m.full_name} size={32} />
      <div className="min-w-0">
        <span className="text-sm font-medium text-gray-900">{m.full_name}</span>
        <span className="ml-2 inline-flex align-middle">
          <PartyBadge party={m.party} />
        </span>
        {m.state && <span className="ml-1 text-xs text-gray-500">{m.state}</span>}
      </div>
    </Link>
  );
}
