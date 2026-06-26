/**
 * Phase 3 — Members ingestion.
 *
 * Fetches members (and their terms) from the Congress.gov /v3/member endpoint
 * and upserts them into the `members` and `terms` Supabase tables.
 *
 * Design:
 *  - Idempotent: safe to re-run; member rows are upserted on bioguide_id,
 *    term rows are deleted-then-inserted per batch (the unique index on terms
 *    uses coalesce(district,-1) which PostgREST cannot target with onConflict).
 *  - Incremental: pass `fromDateTime` to only fetch members whose `updateDate`
 *    is at or after that timestamp, keeping daily request usage low.
 *  - Testable: CongressClient and Supabase client are both injectable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { CongressClient } from "./_client.ts";
import type { Database, Chamber, Party } from "../lib/database.types.ts";

// ---------------------------------------------------------------------------
// Congress.gov API response shapes
// ---------------------------------------------------------------------------

/** An item in the /v3/member list. */
export interface ApiMemberListItem {
  bioguideId: string;
  /** Inverted full name: "LastName, FirstName [Middle]" */
  name: string;
  partyName?: string;
  /** Two-letter postal code (e.g. "TX"). */
  state?: string;
  /** House members only. */
  district?: number;
  /** congress.gov API URL for this member. */
  url?: string;
  /** ISO-8601 date string: last time congress.gov updated this record. */
  updateDate?: string;
  depiction?: { imageUrl?: string; attribution?: string };
  terms?: ApiTermsWrapper | ApiTermItem[];
}

/** congress.gov wraps the terms array in `{ item: [...] }` in list responses. */
interface ApiTermsWrapper {
  item?: ApiTermItem[];
}

export interface ApiTermItem {
  congress?: number;
  /** "House of Representatives" | "Senate" */
  chamber?: string;
  memberType?: string;
  startYear?: number;
  endYear?: number;
  stateCode?: string;
  stateName?: string;
  district?: number;
  partyName?: string;
}

// ---------------------------------------------------------------------------
// Pure transformation helpers (all exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Parse an inverted name ("LastName, FirstName Middle") into parts.
 * Falls back gracefully for unexpected formats.
 */
export function parseMemberName(invertedName: string): {
  first: string;
  last: string;
  full: string;
} {
  const trimmed = invertedName.trim();
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) {
    // No comma — treat the whole thing as last name.
    return { first: "", last: trimmed, full: trimmed };
  }
  const last = trimmed.slice(0, commaIdx).trim();
  const first = trimmed.slice(commaIdx + 1).trim();
  // Natural order full name.
  const full = first ? `${first} ${last}` : last;
  return { first, last, full };
}

const PARTY_MAP: Record<string, Party> = {
  republican: "R",
  "republican party": "R",
  democratic: "D",
  democrat: "D",
  "democratic party": "D",
  independent: "I",
  "independent democrat": "ID",
  libertarian: "L",
};

export function mapParty(partyName: string | undefined): Party | null {
  if (!partyName) return null;
  const key = partyName.toLowerCase().trim();
  return PARTY_MAP[key] ?? "Other";
}

const CHAMBER_MAP: Record<string, Chamber> = {
  "house of representatives": "house",
  house: "house",
  h: "house",
  senate: "senate",
  s: "senate",
};

export function mapChamber(chamberName: string | undefined): Chamber | null {
  if (!chamberName) return null;
  return CHAMBER_MAP[chamberName.toLowerCase().trim()] ?? null;
}

/** Extract the term array regardless of whether it's wrapped or bare. */
export function extractTerms(
  terms: ApiMemberListItem["terms"],
): ApiTermItem[] {
  if (!terms) return [];
  if (Array.isArray(terms)) return terms;
  return terms.item ?? [];
}

/**
 * Determine the member's current chamber from their terms: the most recent
 * (highest congress number) term wins.
 */
export function determineChamber(terms: ApiTermItem[]): Chamber | null {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => (b.congress ?? 0) - (a.congress ?? 0));
  return mapChamber(sorted[0].chamber);
}

/** Shape of a members row ready for Supabase upsert. */
export interface MemberRow {
  bioguide_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  party: Party | null;
  state: string | null;
  current_chamber: Chamber | null;
  image_url: string | null;
  congress_url: string | null;
  source_updated_at: string | null;
}

/** Shape of a terms row ready for Supabase insert. */
export interface TermRow {
  bioguide_id: string;
  congress: number;
  chamber: Chamber;
  state: string | null;
  district: number | null;
  party: Party | null;
  start_year: number | null;
  end_year: number | null;
}

export function transformMember(item: ApiMemberListItem): MemberRow {
  const { first, last, full } = parseMemberName(item.name);
  const terms = extractTerms(item.terms);
  return {
    bioguide_id: item.bioguideId,
    first_name: first,
    last_name: last,
    full_name: full,
    party: mapParty(item.partyName),
    state: item.state ?? null,
    current_chamber: determineChamber(terms),
    image_url: item.depiction?.imageUrl ?? null,
    congress_url: item.url ?? null,
    source_updated_at: item.updateDate ? new Date(item.updateDate).toISOString() : null,
  };
}

export function transformTerms(
  bioguideId: string,
  terms: ApiTermItem[],
  fallbackState: string | null,
): TermRow[] {
  const rows: TermRow[] = [];
  for (const t of terms) {
    const chamber = mapChamber(t.chamber);
    if (!chamber || t.congress == null) continue; // skip malformed rows
    rows.push({
      bioguide_id: bioguideId,
      congress: t.congress,
      chamber,
      state: t.stateCode ?? t.stateName ?? fallbackState,
      district: t.district ?? null,
      party: mapParty(t.partyName),
      start_year: t.startYear ?? null,
      end_year: t.endYear ?? null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main ingestion entry point
// ---------------------------------------------------------------------------

export interface IngestMembersOptions {
  apiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  /**
   * ISO-8601 timestamp. When provided, only members whose congress.gov
   * `updateDate` is >= this value are fetched. Use the `source_updated_at`
   * of the last successful run for efficient incremental syncs.
   */
  fromDateTime?: string;
  /** Filter to a single congress number (e.g. 119). Omit for all. */
  congress?: number;
  /**
   * When true, only currently serving members are fetched.
   * Defaults to false so historical terms are preserved.
   */
  currentMember?: boolean;
  /** Page size (1–250). Defaults to 250. */
  pageSize?: number;
  /** Hard cap on total members processed. Useful for smoke tests. */
  maxItems?: number;
  /** Injectable CongressClient (defaults to a new one built from apiKey). */
  client?: CongressClient;
  /** Injectable Supabase service-role client (defaults to a new one). */
  db?: SupabaseClient<Database>;
}

export interface IngestResult {
  membersUpserted: number;
  termsProcessed: number;
  errors: Array<{ bioguideId: string; error: string }>;
  requestsUsed: number;
}

/** Chunk an array into sub-arrays of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function ingestMembers(
  opts: IngestMembersOptions,
): Promise<IngestResult> {
  const congressClient =
    opts.client ??
    new CongressClient({ apiKey: opts.apiKey, minIntervalMs: 200 });

  const db =
    opts.db ??
    createClient<Database>(opts.supabaseUrl, opts.supabaseServiceKey, {
      auth: { persistSession: false },
    });

  const result: IngestResult = {
    membersUpserted: 0,
    termsProcessed: 0,
    errors: [],
    requestsUsed: 0,
  };

  // Collect one page at a time. Each page is upserted before the next is
  // fetched, so a crash mid-run leaves the DB partially updated but consistent.
  const PAGE = 250;
  let page: ApiMemberListItem[] = [];

  const paginateParams: Record<string, string | number | undefined> = {};
  if (opts.fromDateTime) paginateParams.fromDateTime = opts.fromDateTime;
  if (opts.congress) paginateParams.congress = opts.congress;
  if (opts.currentMember) paginateParams.currentMember = "true";

  for await (const raw of congressClient.paginate<ApiMemberListItem>(
    "member",
    {
      pageSize: opts.pageSize ?? PAGE,
      maxItems: opts.maxItems,
      params: paginateParams,
      itemsKey: "members",
    },
  )) {
    page.push(raw);
    if (page.length >= PAGE) {
      await processPage(page, db, result);
      page = [];
    }
  }
  if (page.length > 0) await processPage(page, db, result);

  result.requestsUsed = congressClient.requestsUsedToday;
  return result;
}

async function processPage(
  items: ApiMemberListItem[],
  db: SupabaseClient<Database>,
  result: IngestResult,
): Promise<void> {
  const memberRows = items.map(transformMember);
  const bioguideIds = memberRows.map((r) => r.bioguide_id);

  // --- Upsert members (batch) ---
  // Split into sub-batches of 100 to stay well within PostgREST body limits.
  for (const batch of chunk(memberRows, 100)) {
    const { error } = await (db as any)
      .from("members")
      .upsert(batch, { onConflict: "bioguide_id" });
    if (error) {
      for (const row of batch) {
        result.errors.push({ bioguideId: row.bioguide_id, error: error.message });
      }
      // Don't attempt terms for this batch if members failed.
      return;
    }
    result.membersUpserted += batch.length;
  }

  // --- Terms: delete existing then insert fresh ---
  // We can't use onConflict with the expression-based unique index
  // (coalesce(district,-1)), so delete-then-insert is the safe pattern.
  for (const batch of chunk(bioguideIds, 100)) {
    const { error: delErr } = await (db as any)
      .from("terms")
      .delete()
      .in("bioguide_id", batch);
    if (delErr) {
      for (const id of batch) {
        result.errors.push({ bioguideId: id, error: `terms delete: ${delErr.message}` });
      }
      continue;
    }
  }

  const allTermRows: TermRow[] = [];
  for (const item of items) {
    const terms = extractTerms(item.terms);
    const rows = transformTerms(item.bioguideId, terms, item.state ?? null);
    allTermRows.push(...rows);
  }

  if (allTermRows.length > 0) {
    for (const batch of chunk(allTermRows, 100)) {
      const { error: insErr } = await (db as any)
        .from("terms")
        .insert(batch);
      if (insErr) {
        // Record per bioguide_id so errors are attributable.
        const affected = [...new Set(batch.map((r) => r.bioguide_id))];
        for (const id of affected) {
          result.errors.push({ bioguideId: id, error: `terms insert: ${insErr.message}` });
        }
        continue;
      }
      result.termsProcessed += batch.length;
    }
  }
}
