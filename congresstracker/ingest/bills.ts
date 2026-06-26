/**
 * Phase 5 — Bills ingestion.
 *
 * Fetches bills from the Congress.gov /v3/bill endpoint and upserts them into
 * `bills`, plus `sponsorships` (primary sponsor, and optionally cosponsors).
 *
 * Cost model (the ~5,000 req/day limit matters here):
 *  - The bill LIST endpoint is cheap (250 bills/request) but omits sponsors,
 *    introduced date and policy area.
 *  - Those live on the bill DETAIL endpoint — one request per bill. So detail
 *    fetching is opt-out (`withDetail`, default true) and cosponsor paging is
 *    opt-in (`withCosponsors`, default false), since cosponsors cost yet more
 *    requests per bill.
 *
 * Integrity:
 *  - bills are upserted on the `id` PK ("{congress}-{type}-{number}").
 *  - sponsorships FK to `members`; a bill can be sponsored by a former member
 *    not in our table, so we filter sponsorship rows to known member ids
 *    (loaded once) to avoid FK violations. Skipped rows are counted.
 *  - sponsorships upsert on the (bioguide_id, bill_id) unique constraint.
 *
 * Testable: CongressClient and the Supabase client are injectable; all
 * transforms are pure and exported.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { CongressClient } from "./_client.ts";
import type { Database } from "../lib/database.types.ts";

// ---------------------------------------------------------------------------
// Congress.gov API response shapes
// ---------------------------------------------------------------------------

export interface ApiLatestAction {
  actionDate?: string;
  text?: string;
}

export interface ApiBillSponsor {
  bioguideId?: string;
  fullName?: string;
  party?: string;
  state?: string;
  /** Present on cosponsors. */
  sponsorshipDate?: string;
}

/** Item from the /v3/bill list endpoint. */
export interface ApiBillListItem {
  congress: number;
  /** "HR", "S", "HJRES", … */
  type: string;
  /** Bill number as a string. */
  number: string;
  title?: string;
  originChamber?: string;
  latestAction?: ApiLatestAction;
  policyArea?: { name?: string };
  updateDate?: string;
  updateDateIncludingText?: string;
  url?: string;
}

/** Item from the /v3/bill/{congress}/{type}/{number} detail endpoint. */
export interface ApiBillDetail extends ApiBillListItem {
  introducedDate?: string;
  sponsors?: ApiBillSponsor[];
  cosponsors?: { count?: number; url?: string };
  laws?: { number?: string; type?: string }[];
}

// ---------------------------------------------------------------------------
// Row shapes (ready for Supabase)
// ---------------------------------------------------------------------------

export interface BillRow {
  id: string;
  congress: number;
  bill_type: string;
  number: number;
  title: string | null;
  short_title: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action: string | null;
  became_law: boolean;
  policy_area: string | null;
  congress_url: string | null;
  source_updated_at: string | null;
}

export interface SponsorshipRow {
  bioguide_id: string;
  bill_id: string;
  is_sponsor: boolean;
  sponsored_date: string | null;
}

// ---------------------------------------------------------------------------
// Pure transformation helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Canonical bill id: "{congress}-{type}-{number}" with lowercase type. */
export function makeBillId(
  congress: number,
  type: string,
  number: string | number,
): string {
  return `${congress}-${String(type).toLowerCase()}-${number}`;
}

/** A bill became law if it has a `laws` entry or its latest action says so. */
export function detectBecameLaw(item: ApiBillListItem | ApiBillDetail): boolean {
  const laws = (item as ApiBillDetail).laws;
  if (Array.isArray(laws) && laws.length > 0) return true;
  const text = item.latestAction?.text ?? "";
  return /became (public|private) law/i.test(text);
}

function toIso(date: string | undefined): string | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Build a BillRow from a list item or (richer) detail object. Detail fields
 * win when present, so passing `{ ...listItem, ...detail }` enriches cleanly.
 */
export function transformBill(item: ApiBillListItem | ApiBillDetail): BillRow {
  const billType = String(item.type).toLowerCase();
  const number = Number(item.number);
  const detail = item as ApiBillDetail;
  return {
    id: makeBillId(item.congress, billType, item.number),
    congress: item.congress,
    bill_type: billType,
    number: Number.isFinite(number) ? number : 0,
    title: item.title ?? null,
    short_title: null, // not reliably available without the /titles sub-endpoint
    introduced_date: detail.introducedDate ?? null,
    latest_action_date: item.latestAction?.actionDate ?? null,
    latest_action: item.latestAction?.text ?? null,
    became_law: detectBecameLaw(item),
    policy_area: item.policyArea?.name ?? null,
    congress_url: item.url ?? null,
    source_updated_at:
      toIso(item.updateDateIncludingText) ?? toIso(item.updateDate),
  };
}

/** Primary-sponsor rows from a bill detail (cosponsors fetched separately). */
export function transformSponsors(
  billId: string,
  detail: ApiBillDetail,
): SponsorshipRow[] {
  const rows: SponsorshipRow[] = [];
  for (const s of detail.sponsors ?? []) {
    if (!s.bioguideId) continue;
    rows.push({
      bill_id: billId,
      bioguide_id: s.bioguideId,
      is_sponsor: true,
      sponsored_date: detail.introducedDate ?? null,
    });
  }
  return rows;
}

/** A single cosponsor row. */
export function transformCosponsor(
  billId: string,
  cosponsor: ApiBillSponsor,
): SponsorshipRow | null {
  if (!cosponsor.bioguideId) return null;
  return {
    bill_id: billId,
    bioguide_id: cosponsor.bioguideId,
    is_sponsor: false,
    sponsored_date: cosponsor.sponsorshipDate ?? null,
  };
}

/**
 * Detail-endpoint path for a bill. The list item's `url` already points there,
 * but we rebuild it from parts so the call is independent of that field.
 */
export function billDetailPath(congress: number, type: string, number: string): string {
  return `bill/${congress}/${String(type).toLowerCase()}/${number}`;
}

// ---------------------------------------------------------------------------
// Main ingestion entry point
// ---------------------------------------------------------------------------

export interface IngestBillsOptions {
  apiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  /** Restrict to one congress (e.g. 119). Omit to page recent bills across all. */
  congress?: number;
  /** ISO-8601; only fetch bills updated at/after this (incremental sync). */
  fromDateTime?: string;
  /** Fetch each bill's detail to get sponsors + introduced/policy fields. */
  withDetail?: boolean;
  /** Also page cosponsors per bill (expensive). Implies withDetail. */
  withCosponsors?: boolean;
  /** Cap total cosponsors fetched per bill (safety valve). */
  maxCosponsorsPerBill?: number;
  /** Filter sponsorship rows to existing members to avoid FK errors. */
  filterMissingMembers?: boolean;
  pageSize?: number;
  maxItems?: number;
  client?: CongressClient;
  db?: SupabaseClient<Database>;
  /** Pre-supplied set of known member ids (skips the DB load). */
  knownMemberIds?: Set<string>;
}

export interface BillIngestResult {
  billsUpserted: number;
  sponsorshipsUpserted: number;
  skippedSponsorships: number;
  errors: Array<{ billId: string; error: string }>;
  requestsUsed: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Load all member bioguide_ids (paged) for FK filtering. */
async function loadMemberIds(
  db: SupabaseClient<Database>,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await (db as any)
      .from("members")
      .select("bioguide_id")
      .range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as Array<{ bioguide_id: string }>) ids.add(r.bioguide_id);
    if (data.length < size) break;
    from += size;
  }
  return ids;
}

export async function ingestBills(
  opts: IngestBillsOptions,
): Promise<BillIngestResult> {
  const client =
    opts.client ?? new CongressClient({ apiKey: opts.apiKey, minIntervalMs: 200 });
  const db =
    opts.db ??
    createClient<Database>(opts.supabaseUrl, opts.supabaseServiceKey, {
      auth: { persistSession: false },
    });

  const withDetail = opts.withDetail ?? true;
  const withCosponsors = opts.withCosponsors ?? false;
  const filterMissing = opts.filterMissingMembers ?? true;

  const result: BillIngestResult = {
    billsUpserted: 0,
    sponsorshipsUpserted: 0,
    skippedSponsorships: 0,
    errors: [],
    requestsUsed: 0,
  };

  const knownMembers: Set<string> | null = filterMissing
    ? opts.knownMemberIds ?? (await loadMemberIds(db))
    : null;

  const listPath = opts.congress ? `bill/${opts.congress}` : "bill";
  const params: Record<string, string | number | undefined> = {
    sort: "updateDate+desc",
  };
  if (opts.fromDateTime) params.fromDateTime = opts.fromDateTime;

  const PAGE = 250;
  let billBuf: BillRow[] = [];
  let sponsorBuf: SponsorshipRow[] = [];

  const flush = async () => {
    await flushBills(billBuf, db, result);
    await flushSponsorships(sponsorBuf, db, result, knownMembers);
    billBuf = [];
    sponsorBuf = [];
  };

  for await (const listItem of client.paginate<ApiBillListItem>(listPath, {
    pageSize: opts.pageSize ?? PAGE,
    maxItems: opts.maxItems,
    params,
    itemsKey: "bills",
  })) {
    let bill = transformBill(listItem);
    const billSponsors: SponsorshipRow[] = [];

    if (withDetail || withCosponsors) {
      try {
        const resp = await client.get<{ bill: ApiBillDetail }>(
          billDetailPath(listItem.congress, listItem.type, listItem.number),
        );
        const detail = resp.bill ?? {};
        bill = transformBill({ ...listItem, ...detail });
        billSponsors.push(...transformSponsors(bill.id, detail));

        if (withCosponsors && (detail.cosponsors?.count ?? 0) > 0) {
          const cosPath = `${billDetailPath(listItem.congress, listItem.type, listItem.number)}/cosponsors`;
          for await (const c of client.paginate<ApiBillSponsor>(cosPath, {
            itemsKey: "cosponsors",
            maxItems: opts.maxCosponsorsPerBill,
          })) {
            const row = transformCosponsor(bill.id, c);
            if (row) billSponsors.push(row);
          }
        }
      } catch (err) {
        result.errors.push({
          billId: bill.id,
          error: `detail: ${(err as Error).message}`,
        });
      }
    }

    billBuf.push(bill);
    sponsorBuf.push(...billSponsors);

    if (billBuf.length >= PAGE) await flush();
  }
  await flush();

  result.requestsUsed = client.requestsUsedToday;
  return result;
}

async function flushBills(
  bills: BillRow[],
  db: SupabaseClient<Database>,
  result: BillIngestResult,
): Promise<void> {
  for (const batch of chunk(bills, 100)) {
    if (batch.length === 0) continue;
    const { error } = await (db as any)
      .from("bills")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      for (const b of batch) {
        result.errors.push({ billId: b.id, error: `bill upsert: ${error.message}` });
      }
      continue;
    }
    result.billsUpserted += batch.length;
  }
}

async function flushSponsorships(
  sponsors: SponsorshipRow[],
  db: SupabaseClient<Database>,
  result: BillIngestResult,
  knownMembers: Set<string> | null,
): Promise<void> {
  let rows = sponsors;
  if (knownMembers) {
    const before = rows.length;
    rows = rows.filter((r) => knownMembers.has(r.bioguide_id));
    result.skippedSponsorships += before - rows.length;
  }
  // De-dupe within this batch on (bioguide_id, bill_id) so a single upsert
  // doesn't hit "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const seen = new Set<string>();
  const deduped: SponsorshipRow[] = [];
  for (const r of rows) {
    const key = `${r.bioguide_id}::${r.bill_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  for (const batch of chunk(deduped, 100)) {
    if (batch.length === 0) continue;
    const { error } = await (db as any)
      .from("sponsorships")
      .upsert(batch, { onConflict: "bioguide_id,bill_id" });
    if (error) {
      const bills = [...new Set(batch.map((r) => r.bill_id))];
      for (const billId of bills) {
        result.errors.push({
          billId,
          error: `sponsorship upsert: ${error.message}`,
        });
      }
      continue;
    }
    result.sponsorshipsUpserted += batch.length;
  }
}
