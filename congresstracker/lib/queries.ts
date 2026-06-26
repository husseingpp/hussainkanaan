/**
 * Server-side data-fetching helpers for CongressTracker.
 *
 * All functions use the anon (public) Supabase client — read-only, gated by
 * Row Level Security. Every function returns a safe default (empty array / null)
 * when Supabase is not configured or returns an error, so pages render cleanly
 * even before the ingestion job has run.
 */

import { createPublicClient } from "./supabase.ts";
import type { Member, Term } from "./database.types.ts";

export const PER_PAGE = 100;

export interface MemberFilters {
  chamber?: string;
  party?: string;
  state?: string;
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
