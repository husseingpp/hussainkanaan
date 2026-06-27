/**
 * Data-fetching helpers for CongressTracker.
 *
 * All functions use the anon (public) Supabase client — read-only, gated by
 * Row Level Security. The anon key is a NEXT_PUBLIC_ value, so these run safely
 * on the server (Vercel) AND in the browser (the GitHub Pages static-export
 * build fetches everything client-side). Every function returns a safe default
 * (empty array / null) when Supabase is not configured or returns an error, so
 * pages render cleanly even before the ingestion job has run.
 */

import { createPublicClient } from "./supabase.ts";
import * as demo from "./demo.ts";
import type {
  Member,
  Term,
  Bill,
  Sponsorship,
  Vote,
  AlignmentScore,
  PromiseRow,
} from "./database.types.ts";

export const PER_PAGE = 100;

export interface MemberFilters {
  chamber?: string;
  party?: string;
  state?: string;
  /** Descriptive ideology wing: left / center / right. */
  wing?: string;
  /** Case-insensitive full-name substring search. */
  q?: string;
  /** Zero-based page index. */
  page?: string | number;
}

export interface MemberListResult {
  members: Member[];
  total: number;
  page: number;
}

function safeDb() {
  try {
    return createPublicClient();
  } catch {
    return null;
  }
}

export async function getMembers(
  filters: MemberFilters = {},
): Promise<MemberListResult> {
  if (demo.isDemo()) return demo.demoGetMembers(filters);
  const db = safeDb();
  if (!db) return { members: [], total: 0, page: 0 };

  const page = Math.max(0, Number(filters.page ?? 0));
  const from = page * PER_PAGE;
  const to = from + PER_PAGE - 1;

  try {
    // Build query progressively; cast at the end rather than fighting the
    // hand-written Database generic (replaced by generated types once the
    // Supabase project is linked).
    // eslint-disable-next-line
    let q: any = (db as any)
      .from("members")
      .select("*", { count: "exact" })
      .order("last_name")
      .order("first_name")
      .range(from, to);

    if (filters.chamber === "house" || filters.chamber === "senate") {
      q = q.eq("current_chamber", filters.chamber);
    }
    const validParties = ["D", "R", "I", "ID", "L", "Other"];
    if (filters.party && validParties.includes(filters.party)) {
      q = q.eq("party", filters.party);
    }
    if (filters.state && /^[A-Z]{2}$/.test(filters.state)) {
      q = q.eq("state", filters.state);
    }
    if (
      filters.wing === "left" ||
      filters.wing === "center" ||
      filters.wing === "right"
    ) {
      q = q.eq("current_wing", filters.wing);
    }
    const name = filters.q?.trim();
    if (name) {
      // Escape SQL wildcard characters the user might type literally.
      const escaped = name.replace(/[%_\\]/g, "\\$&");
      q = q.ilike("full_name", `%${escaped}%`);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return { members: (data as Member[]) ?? [], total: count ?? 0, page };
  } catch {
    return { members: [], total: 0, page };
  }
}

export async function getMember(bioguideId: string): Promise<Member | null> {
  if (demo.isDemo()) return demo.demoGetMember(bioguideId);
  const db = safeDb();
  if (!db) return null;
  try {
    const { data, error } = await (db as any)
      .from("members")
      .select("*")
      .eq("bioguide_id", bioguideId)
      .single();
    if (error) return null;
    return (data as Member) ?? null;
  } catch {
    return null;
  }
}

export async function getMemberTerms(bioguideId: string): Promise<Term[]> {
  if (demo.isDemo()) return demo.demoGetMemberTerms(bioguideId);
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("terms")
      .select("*")
      .eq("bioguide_id", bioguideId)
      .order("congress", { ascending: false });
    if (error) return [];
    return (data as Term[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export interface BillFilters {
  congress?: string | number;
  /** "law" -> only enacted bills. */
  status?: string;
  q?: string;
  page?: string | number;
}

export interface BillListResult {
  bills: Bill[];
  total: number;
  page: number;
}

export async function getBills(
  filters: BillFilters = {},
): Promise<BillListResult> {
  if (demo.isDemo()) return demo.demoGetBills(filters);
  const db = safeDb();
  if (!db) return { bills: [], total: 0, page: 0 };

  const page = Math.max(0, Number(filters.page ?? 0));
  const from = page * PER_PAGE;
  const to = from + PER_PAGE - 1;

  try {
    // eslint-disable-next-line
    let q: any = (db as any)
      .from("bills")
      .select("*", { count: "exact" })
      .order("latest_action_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, to);

    const congress = Number(filters.congress);
    if (Number.isFinite(congress) && congress > 0) {
      q = q.eq("congress", congress);
    }
    if (filters.status === "law") {
      q = q.eq("became_law", true);
    }
    const title = filters.q?.trim();
    if (title) {
      const escaped = title.replace(/[%_\\]/g, "\\$&");
      q = q.ilike("title", `%${escaped}%`);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return { bills: (data as Bill[]) ?? [], total: count ?? 0, page };
  } catch {
    return { bills: [], total: 0, page };
  }
}

export async function getBill(id: string): Promise<Bill | null> {
  if (demo.isDemo()) return demo.demoGetBill(id);
  const db = safeDb();
  if (!db) return null;
  try {
    const { data, error } = await (db as any)
      .from("bills")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return (data as Bill) ?? null;
  } catch {
    return null;
  }
}

/** A sponsorship joined with the sponsoring member (for bill pages). */
export interface SponsorshipWithMember extends Sponsorship {
  members: Pick<
    Member,
    "bioguide_id" | "full_name" | "party" | "state" | "current_chamber" | "image_url"
  > | null;
}

export async function getBillSponsorships(
  billId: string,
): Promise<SponsorshipWithMember[]> {
  if (demo.isDemo()) return demo.demoGetBillSponsorships(billId);
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("sponsorships")
      .select(
        "*, members(bioguide_id, full_name, party, state, current_chamber, image_url)",
      )
      .eq("bill_id", billId)
      .order("is_sponsor", { ascending: false })
      .order("sponsored_date", { ascending: true, nullsFirst: false });
    if (error) return [];
    return (data as SponsorshipWithMember[]) ?? [];
  } catch {
    return [];
  }
}

/** A sponsorship joined with the bill (for member profile pages). */
export interface SponsorshipWithBill extends Sponsorship {
  bills: Pick<
    Bill,
    "id" | "congress" | "bill_type" | "number" | "title" | "became_law" | "latest_action_date"
  > | null;
}

export async function getMemberSponsorships(
  bioguideId: string,
  limit = 25,
): Promise<SponsorshipWithBill[]> {
  if (demo.isDemo()) return demo.demoGetMemberSponsorships(bioguideId, limit);
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("sponsorships")
      .select(
        "*, bills(id, congress, bill_type, number, title, became_law, latest_action_date)",
      )
      .eq("bioguide_id", bioguideId)
      .order("is_sponsor", { ascending: false })
      .order("sponsored_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return [];
    return (data as SponsorshipWithBill[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

/** A vote joined with its (optional) bill. */
export interface VoteWithBill extends Vote {
  bills: Pick<Bill, "id" | "bill_type" | "number" | "title"> | null;
}

export async function getMemberVotes(
  bioguideId: string,
  limit = 25,
): Promise<VoteWithBill[]> {
  if (demo.isDemo()) return demo.demoGetMemberVotes(bioguideId, limit);
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("votes")
      .select("*, bills(id, bill_type, number, title)")
      .eq("bioguide_id", bioguideId)
      .order("vote_date", { ascending: false, nullsFirst: false })
      .order("roll_call", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data as VoteWithBill[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Alignment scores (wings)
// ---------------------------------------------------------------------------

/**
 * The member's most recent DW-NOMINATE alignment score, or null if none has
 * been ingested. Used to show the sourced wing classification on the profile.
 */
export async function getMemberAlignment(
  bioguideId: string,
): Promise<AlignmentScore | null> {
  if (demo.isDemo()) return demo.demoGetMemberAlignment(bioguideId);
  const db = safeDb();
  if (!db) return null;
  try {
    const { data, error } = await (db as any)
      .from("alignment_scores")
      .select("*")
      .eq("bioguide_id", bioguideId)
      .order("congress", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as AlignmentScore) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Promises
// ---------------------------------------------------------------------------

/**
 * A member's promises (public read). Every promise carries a source_url
 * (schema-enforced); resolved statuses additionally carry a reviewer + a
 * status source. Ordered with resolved promises first, then by recency.
 */
export async function getMemberPromises(
  bioguideId: string,
): Promise<PromiseRow[]> {
  if (demo.isDemo()) return demo.demoGetMemberPromises(bioguideId);
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("promises")
      .select("*")
      .eq("bioguide_id", bioguideId)
      .order("made_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data as PromiseRow[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Three-wing browse
// ---------------------------------------------------------------------------

export interface WingColumn {
  members: Member[];
  total: number;
}

export interface WingBrowse {
  left: WingColumn;
  center: WingColumn;
  right: WingColumn;
}

/**
 * Members grouped into left / center / right for the Ground-News-style browse.
 * Runs one query per wing: a capped list for display plus an exact total, so a
 * column can say "showing 50 of 213" and link to the full filtered list.
 */
export async function getMembersByWing(
  filters: { chamber?: string; state?: string } = {},
  perColumn = 50,
): Promise<WingBrowse> {
  if (demo.isDemo()) return demo.demoGetMembersByWing(filters, perColumn);
  const empty: WingBrowse = {
    left: { members: [], total: 0 },
    center: { members: [], total: 0 },
    right: { members: [], total: 0 },
  };
  const db = safeDb();
  if (!db) return empty;

  async function column(wing: string): Promise<WingColumn> {
    try {
      // eslint-disable-next-line
      let q: any = (db as any)
        .from("members")
        .select("*", { count: "exact" })
        .eq("current_wing", wing)
        .order("last_name")
        .order("first_name")
        .limit(perColumn);
      if (filters.chamber === "house" || filters.chamber === "senate") {
        q = q.eq("current_chamber", filters.chamber);
      }
      if (filters.state && /^[A-Z]{2}$/.test(filters.state)) {
        q = q.eq("state", filters.state);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { members: (data as Member[]) ?? [], total: count ?? 0 };
    } catch {
      return { members: [], total: 0 };
    }
  }

  const [left, center, right] = await Promise.all([
    column("left"),
    column("center"),
    column("right"),
  ]);
  return { left, center, right };
}

// ---------------------------------------------------------------------------
// Member stats (compare view)
// ---------------------------------------------------------------------------

export interface MemberStats {
  sponsored: number;
  cosponsored: number;
  billsBecameLaw: number;
  votes: number;
}

/** Lightweight head-only counts for the compare view (no row payloads). */
export async function getMemberStats(bioguideId: string): Promise<MemberStats> {
  if (demo.isDemo()) return demo.demoGetMemberStats(bioguideId);
  const zero: MemberStats = {
    sponsored: 0,
    cosponsored: 0,
    billsBecameLaw: 0,
    votes: 0,
  };
  const db = safeDb();
  if (!db) return zero;

  async function count(
    build: (q: any) => any,
    table: string,
  ): Promise<number> {
    try {
      const { count, error } = await build(
        (db as any).from(table).select("*", { count: "exact", head: true }),
      );
      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const [sponsored, cosponsored, votes] = await Promise.all([
    count(
      (q) => q.eq("bioguide_id", bioguideId).eq("is_sponsor", true),
      "sponsorships",
    ),
    count(
      (q) => q.eq("bioguide_id", bioguideId).eq("is_sponsor", false),
      "sponsorships",
    ),
    count((q) => q.eq("bioguide_id", bioguideId), "votes"),
  ]);

  return { sponsored, cosponsored, billsBecameLaw: 0, votes };
}

/** Minimal member options (id + name + party/state) for the compare pickers. */
export type MemberOption = Pick<
  Member,
  "bioguide_id" | "full_name" | "party" | "state"
>;

export async function getMemberOptions(): Promise<MemberOption[]> {
  if (demo.isDemo()) return demo.demoGetMemberOptions();
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("members")
      .select("bioguide_id, full_name, party, state")
      .order("last_name")
      .order("first_name")
      .limit(1000);
    if (error) return [];
    return (data as MemberOption[]) ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Build-time static params (GitHub Pages static export)
// ---------------------------------------------------------------------------

/**
 * All member bioguide ids. Used by `generateStaticParams` to pre-render one
 * static shell per member for the static-export build. Returns [] when Supabase
 * is unconfigured (e.g. a build with no secrets) so the build still succeeds —
 * it just produces no per-member pages until a build runs with data available.
 */
export async function getAllMemberIds(): Promise<string[]> {
  if (demo.isDemo()) return demo.demoGetAllMemberIds();
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("members")
      .select("bioguide_id")
      .order("bioguide_id")
      .limit(2000);
    if (error) return [];
    return ((data as Array<{ bioguide_id: string }>) ?? []).map(
      (r) => r.bioguide_id,
    );
  } catch {
    return [];
  }
}

/**
 * All bill ids, capped. Used by `generateStaticParams` for the static-export
 * build. Capped because the bills table can be large; the cap bounds the number
 * of pre-rendered pages (most-recently-actioned first). Bills outside the cap
 * still resolve live on a server host; on Pages they 404 until a wider build.
 */
export async function getAllBillIds(limit = 5000): Promise<string[]> {
  if (demo.isDemo()) return demo.demoGetAllBillIds();
  const db = safeDb();
  if (!db) return [];
  try {
    const { data, error } = await (db as any)
      .from("bills")
      .select("id")
      .order("latest_action_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return [];
    return ((data as Array<{ id: string }>) ?? []).map((r) => r.id);
  } catch {
    return [];
  }
}
