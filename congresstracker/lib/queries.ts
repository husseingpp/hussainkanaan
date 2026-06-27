/**
 * Server-side data-fetching helpers for CongressTracker.
 *
 * All functions use the anon (public) Supabase client — read-only, gated by
 * Row Level Security. Every function returns a safe default (empty array / null)
 * when Supabase is not configured or returns an error, so pages render cleanly
 * even before the ingestion job has run.
 */

import { createPublicClient } from "./supabase.ts";
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
