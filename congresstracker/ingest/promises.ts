/**
 * Phase 8 — Promises seed loader.
 *
 * Promises are the most defamation-sensitive data in the product, so this
 * module does NOT generate any factual claim about a real person. It only
 * loads promises that a human authored (with a real source_url) from a seed
 * file, validating each against the same rules the database enforces:
 *
 *   - bioguide_id, text and source_url are mandatory and non-empty (hard rule 2:
 *     no source, no display).
 *   - status defaults to `unverified`. A resolved status (kept/broken/partial/
 *     stalled) requires BOTH a reviewer (reviewed_by) and a status source
 *     (status_source_url) — mirroring the DB CHECK (hard rules 1 & 5: never
 *     guess, a verdict needs a reviewer and evidence).
 *
 * Seeds should carry a stable `id` (uuid) so re-running is idempotent (upsert on
 * the primary key). FK-safe like the other ingests: a seed for a member not in
 * our table is skipped and counted, never inserted.
 *
 * Testable: validation/normalisation are pure and exported; the Supabase client
 * is injectable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Database, PromiseStatus } from "../lib/database.types.ts";

const VALID_STATUSES: PromiseStatus[] = [
  "unverified",
  "kept",
  "broken",
  "partial",
  "stalled",
];

/** The raw shape accepted from a seed file (all fields untrusted). */
export interface PromiseSeed {
  id?: string;
  bioguide_id?: string;
  text?: string;
  topic?: string | null;
  made_date?: string | null;
  made_context?: string | null;
  source_url?: string;
  status?: string;
  status_rationale?: string | null;
  status_source_url?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

/** A validated row ready to upsert into `promises`. */
export interface PromiseRowInsert {
  id?: string;
  bioguide_id: string;
  text: string;
  topic: string | null;
  made_date: string | null;
  made_context: string | null;
  source_url: string;
  status: PromiseStatus;
  status_rationale: string | null;
  status_source_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface ValidationResult {
  ok: boolean;
  value?: PromiseRowInsert;
  errors: string[];
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate + normalise a single seed. Returns the row to insert, or the list of
 * reasons it was rejected. Enforces the same invariants as the DB so bad seeds
 * fail loudly here rather than at the database.
 */
export function validatePromiseSeed(seed: PromiseSeed): ValidationResult {
  const errors: string[] = [];

  if (!nonEmpty(seed.bioguide_id)) errors.push("bioguide_id is required");
  if (!nonEmpty(seed.text)) errors.push("text is required");
  if (!nonEmpty(seed.source_url)) errors.push("source_url is required");

  const status = (seed.status ?? "unverified") as PromiseStatus;
  if (!VALID_STATUSES.includes(status)) {
    errors.push(`status "${seed.status}" is not a valid promise_status`);
  }

  const resolved = status !== "unverified";
  if (resolved) {
    // A verdict about a real person must carry a reviewer AND evidence.
    if (!nonEmpty(seed.status_source_url)) {
      errors.push(`status "${status}" requires a status_source_url`);
    }
    if (!nonEmpty(seed.reviewed_by)) {
      errors.push(`status "${status}" requires reviewed_by (a reviewer id)`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: PromiseRowInsert = {
    bioguide_id: seed.bioguide_id!.trim(),
    text: seed.text!.trim(),
    topic: nonEmpty(seed.topic) ? seed.topic!.trim() : null,
    made_date: nonEmpty(seed.made_date) ? seed.made_date!.trim() : null,
    made_context: nonEmpty(seed.made_context) ? seed.made_context!.trim() : null,
    source_url: seed.source_url!.trim(),
    status,
    status_rationale: nonEmpty(seed.status_rationale)
      ? seed.status_rationale!.trim()
      : null,
    status_source_url: nonEmpty(seed.status_source_url)
      ? seed.status_source_url!.trim()
      : null,
    reviewed_by: nonEmpty(seed.reviewed_by) ? seed.reviewed_by!.trim() : null,
    reviewed_at:
      resolved && !nonEmpty(seed.reviewed_at)
        ? new Date().toISOString()
        : nonEmpty(seed.reviewed_at)
          ? seed.reviewed_at!.trim()
          : null,
  };
  if (nonEmpty(seed.id)) value.id = seed.id!.trim();

  return { ok: true, value, errors: [] };
}

export interface LoadResult {
  rows: PromiseRowInsert[];
  rejected: Array<{ index: number; errors: string[] }>;
}

/** Validate a whole seed array, partitioning into rows + rejections. */
export function loadPromiseSeeds(seeds: PromiseSeed[]): LoadResult {
  const rows: PromiseRowInsert[] = [];
  const rejected: Array<{ index: number; errors: string[] }> = [];
  seeds.forEach((seed, index) => {
    const res = validatePromiseSeed(seed);
    if (res.ok && res.value) rows.push(res.value);
    else rejected.push({ index, errors: res.errors });
  });
  return { rows, rejected };
}

// ---------------------------------------------------------------------------
// Ingestion entry point
// ---------------------------------------------------------------------------

export interface IngestPromisesOptions {
  supabaseUrl: string;
  supabaseServiceKey: string;
  seeds: PromiseSeed[];
  db?: SupabaseClient<Database>;
  /** Pre-supplied member set (else loaded from the DB). */
  knownMembers?: Set<string>;
}

export interface PromisesIngestResult {
  upserted: number;
  rejected: number;
  skippedUnknownMember: number;
  errors: Array<{ context: string; error: string }>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadKnownMembers(
  db: SupabaseClient<Database>,
): Promise<Set<string>> {
  const known = new Set<string>();
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await (db as any)
      .from("members")
      .select("bioguide_id")
      .range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as Array<{ bioguide_id: string }>) {
      known.add(r.bioguide_id);
    }
    if (data.length < size) break;
    from += size;
  }
  return known;
}

export async function ingestPromises(
  opts: IngestPromisesOptions,
): Promise<PromisesIngestResult> {
  const db =
    opts.db ??
    createClient<Database>(opts.supabaseUrl, opts.supabaseServiceKey, {
      auth: { persistSession: false },
    });

  const result: PromisesIngestResult = {
    upserted: 0,
    rejected: 0,
    skippedUnknownMember: 0,
    errors: [],
  };

  const { rows, rejected } = loadPromiseSeeds(opts.seeds);
  result.rejected = rejected.length;
  for (const r of rejected) {
    result.errors.push({
      context: `seed[${r.index}]`,
      error: r.errors.join("; "),
    });
  }

  const knownMembers = opts.knownMembers ?? (await loadKnownMembers(db));
  const insertable = rows.filter((r) => {
    if (knownMembers.has(r.bioguide_id)) return true;
    result.skippedUnknownMember += 1;
    return false;
  });

  // Rows carrying an id can be upserted (idempotent); rows without an id are
  // plain inserts. Keep them in separate batches.
  const withId = insertable.filter((r) => r.id);
  const withoutId = insertable.filter((r) => !r.id);

  for (const batch of chunk(withId, 100)) {
    if (batch.length === 0) continue;
    const { error } = await (db as any)
      .from("promises")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      result.errors.push({ context: "promise upsert", error: error.message });
      continue;
    }
    result.upserted += batch.length;
  }
  for (const batch of chunk(withoutId, 100)) {
    if (batch.length === 0) continue;
    const { error } = await (db as any).from("promises").insert(batch);
    if (error) {
      result.errors.push({ context: "promise insert", error: error.message });
      continue;
    }
    result.upserted += batch.length;
  }

  return result;
}
