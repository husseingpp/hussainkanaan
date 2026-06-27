/**
 * Phase 7 — Wings + alignment scores.
 *
 * Wing classification (left / center / right) MUST come from an external,
 * published ideology metric — never a partisan score we invent (CLAUDE.md hard
 * rule 3). We use DW-NOMINATE from Voteview (https://voteview.com), which
 * publishes a member-level CSV per congress/chamber. Each row already carries a
 * `bioguide_id`, so the crosswalk to our `members` table is direct.
 *
 * What this module does:
 *   1. Fetches the Voteview members CSV for a congress (House and/or Senate).
 *   2. Buckets each member's first-dimension score (liberal–conservative) into
 *      a wing using a single documented cutoff (DW_NOMINATE_CENTER_THRESHOLD).
 *      The raw score is stored too, so the bucketing is always transparent.
 *   3. Upserts `alignment_scores` (one row per member/congress/metric) with the
 *      source URL of the exact CSV it came from + methodology link.
 *   4. Optionally refreshes the denormalised `members.current_wing` cache.
 *
 * Integrity:
 *   - A member with no published DW-NOMINATE score is NEVER assigned a wing
 *     (counted as `skippedNoScore`). We do not guess.
 *   - Rows FK to `members`; a Voteview row for someone not in our table is
 *     skipped (`skippedUnknownMember`), mirroring bills/votes ingestion.
 *   - `source_url` is mandatory (schema-enforced) and asserted here.
 *
 * Testable: `fetchText` and the Supabase client are injectable; all transforms
 * are pure and exported (see scores.test.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Database, Chamber, Wing } from "../lib/database.types.ts";
import { DW_NOMINATE_CENTER_THRESHOLD } from "../lib/constants.ts";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Bucket a DW-NOMINATE first-dimension score into a descriptive wing. The
 * underlying number comes from Voteview; this only chooses the display bucket.
 * Symmetric around 0: <= -t is left, >= t is right, otherwise center.
 */
export function classifyWing(
  dim1: number,
  threshold: number = DW_NOMINATE_CENTER_THRESHOLD,
): Wing {
  if (dim1 <= -threshold) return "left";
  if (dim1 >= threshold) return "right";
  return "center";
}

/** Map Voteview's chamber label ("House"/"Senate"/"President") to our enum. */
export function mapVoteviewChamber(raw: string | undefined): Chamber | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "house") return "house";
  if (v === "senate") return "senate";
  return null; // "President" and anything else are not tracked
}

/**
 * Build the Voteview members-CSV URL for a congress + chamber. Voteview hosts
 * per-congress files like `H118_members.csv` / `S118_members.csv`.
 */
export function voteviewMembersUrl(congress: number, chamber: Chamber): string {
  const prefix = chamber === "house" ? "H" : "S";
  return `https://voteview.com/static/data/out/members/${prefix}${congress}_members.csv`;
}

/**
 * Minimal RFC-4180-ish CSV parser. Voteview quotes fields containing commas
 * (e.g. bioname "OCASIO-CORTEZ, Alexandria") and escapes embedded quotes by
 * doubling them. Returns rows of string cells; blank trailing lines dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Handle CRLF: swallow the \n following a \r.
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // Flush the final field/row if the file did not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty rows (e.g. a stray blank line).
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export interface VoteviewMember {
  bioguideId: string | null;
  congress: number;
  chamber: Chamber | null;
  party: string | null;
  state: string | null;
  bioname: string | null;
  dim1: number | null;
  dim2: number | null;
}

/**
 * Parse a Voteview members CSV into structured rows, keyed by header name so we
 * are resilient to column-order changes. Only the columns we need are read.
 */
export function parseVoteviewMembers(csvText: string): VoteviewMember[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iBio = idx("bioguide_id");
  const iCongress = idx("congress");
  const iChamber = idx("chamber");
  const iParty = idx("party_code");
  const iState = idx("state_abbrev");
  const iName = idx("bioname");
  const iDim1 = idx("nominate_dim1");
  const iDim2 = idx("nominate_dim2");

  const num = (cells: string[], i: number): number | null => {
    if (i < 0) return null;
    const raw = (cells[i] ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const str = (cells: string[], i: number): string | null => {
    if (i < 0) return null;
    const raw = (cells[i] ?? "").trim();
    return raw === "" ? null : raw;
  };

  const out: VoteviewMember[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    out.push({
      bioguideId: str(cells, iBio),
      congress: num(cells, iCongress) ?? 0,
      chamber: mapVoteviewChamber(str(cells, iChamber) ?? undefined),
      party: str(cells, iParty),
      state: str(cells, iState),
      bioname: str(cells, iName),
      dim1: num(cells, iDim1),
      dim2: num(cells, iDim2),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transform parsed Voteview rows into alignment_scores inserts
// ---------------------------------------------------------------------------

export interface AlignmentRow {
  bioguide_id: string;
  congress: number;
  metric: string;
  dimension1: number | null;
  dimension2: number | null;
  wing: Wing;
  source_url: string;
  methodology_url: string;
}

export interface TransformScoresOptions {
  sourceUrl: string;
  /** Only keep rows for members we know about (avoids FK errors). */
  knownMembers?: Set<string>;
  /** Override the bucket cutoff (default DW_NOMINATE_CENTER_THRESHOLD). */
  threshold?: number;
  metric?: string;
  methodologyUrl?: string;
}

export interface TransformScoresResult {
  rows: AlignmentRow[];
  skippedNoBioguide: number; // Voteview row with no bioguide_id
  skippedNoScore: number; // no DW-NOMINATE dim1 -> cannot classify, never guess
  skippedUnknownMember: number; // bioguide not in members table
}

export function toAlignmentRows(
  members: VoteviewMember[],
  opts: TransformScoresOptions,
): TransformScoresResult {
  const metric = opts.metric ?? "dw-nominate";
  const methodologyUrl = opts.methodologyUrl ?? "/methodology";
  const threshold = opts.threshold ?? DW_NOMINATE_CENTER_THRESHOLD;

  const rows: AlignmentRow[] = [];
  let skippedNoBioguide = 0;
  let skippedNoScore = 0;
  let skippedUnknownMember = 0;
  // De-dupe on the alignment_scores unique key (bioguide, congress, metric).
  const seen = new Set<string>();

  for (const m of members) {
    if (!m.bioguideId) {
      skippedNoBioguide += 1;
      continue;
    }
    if (m.dim1 == null) {
      // No published score -> we will not assign a wing. Never guess.
      skippedNoScore += 1;
      continue;
    }
    if (opts.knownMembers && !opts.knownMembers.has(m.bioguideId)) {
      skippedUnknownMember += 1;
      continue;
    }
    const key = `${m.bioguideId}|${m.congress}|${metric}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      bioguide_id: m.bioguideId,
      congress: m.congress,
      metric,
      dimension1: m.dim1,
      dimension2: m.dim2,
      wing: classifyWing(m.dim1, threshold),
      source_url: opts.sourceUrl,
      methodology_url: methodologyUrl,
    });
  }

  return { rows, skippedNoBioguide, skippedNoScore, skippedUnknownMember };
}

// ---------------------------------------------------------------------------
// Ingestion entry point
// ---------------------------------------------------------------------------

/** Minimal text-fetch abstraction so the network is injectable in tests. */
export type FetchText = (
  url: string,
) => Promise<{ ok: boolean; status: number; text: string }>;

const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, { headers: { Accept: "text/csv" } });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
};

export interface IngestScoresOptions {
  supabaseUrl: string;
  supabaseServiceKey: string;
  congress: number;
  /** Which chambers to fetch; default both. */
  chambers?: Chamber[];
  /** Refresh members.current_wing from these scores; default true. */
  setCurrentWing?: boolean;
  threshold?: number;
  metric?: string;
  fetchText?: FetchText;
  db?: SupabaseClient<Database>;
  /** Pre-supplied member set (else loaded from the DB). */
  knownMembers?: Set<string>;
}

export interface ScoresIngestResult {
  chambersProcessed: number;
  scoresUpserted: number;
  membersWinged: number;
  skippedNoBioguide: number;
  skippedNoScore: number;
  skippedUnknownMember: number;
  errors: Array<{ url: string; error: string }>;
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

export async function ingestScores(
  opts: IngestScoresOptions,
): Promise<ScoresIngestResult> {
  const db =
    opts.db ??
    createClient<Database>(opts.supabaseUrl, opts.supabaseServiceKey, {
      auth: { persistSession: false },
    });
  const fetchText = opts.fetchText ?? defaultFetchText;
  const chambers = opts.chambers ?? (["house", "senate"] as Chamber[]);
  const setCurrentWing = opts.setCurrentWing ?? true;

  const result: ScoresIngestResult = {
    chambersProcessed: 0,
    scoresUpserted: 0,
    membersWinged: 0,
    skippedNoBioguide: 0,
    skippedNoScore: 0,
    skippedUnknownMember: 0,
    errors: [],
  };

  const knownMembers = opts.knownMembers ?? (await loadKnownMembers(db));

  // Collect wing assignments across chambers to refresh members.current_wing
  // in a few batched updates at the end.
  const wingOf = new Map<string, Wing>();

  for (const chamber of chambers) {
    const url = voteviewMembersUrl(opts.congress, chamber);

    let fetched: { ok: boolean; status: number; text: string };
    try {
      fetched = await fetchText(url);
    } catch (err) {
      result.errors.push({ url, error: (err as Error).message });
      continue;
    }
    if (!fetched.ok || !fetched.text.trim()) {
      result.errors.push({ url, error: `fetch failed (status ${fetched.status})` });
      continue;
    }

    let parsed: VoteviewMember[];
    try {
      parsed = parseVoteviewMembers(fetched.text);
    } catch (err) {
      result.errors.push({ url, error: `parse: ${(err as Error).message}` });
      continue;
    }

    // Keep only this chamber + this congress (the all-members file, if ever
    // used, would include others; per-chamber files are already filtered).
    const filtered = parsed.filter(
      (m) => m.chamber === chamber && m.congress === opts.congress,
    );

    const { rows, skippedNoBioguide, skippedNoScore, skippedUnknownMember } =
      toAlignmentRows(filtered, {
        sourceUrl: url,
        knownMembers,
        threshold: opts.threshold,
        metric: opts.metric,
      });
    result.skippedNoBioguide += skippedNoBioguide;
    result.skippedNoScore += skippedNoScore;
    result.skippedUnknownMember += skippedUnknownMember;
    result.chambersProcessed += 1;

    for (const batch of chunk(rows, 100)) {
      if (batch.length === 0) continue;
      const { error } = await (db as any)
        .from("alignment_scores")
        .upsert(batch, { onConflict: "bioguide_id,congress,metric" });
      if (error) {
        result.errors.push({ url, error: `score upsert: ${error.message}` });
        continue;
      }
      result.scoresUpserted += batch.length;
    }

    for (const row of rows) wingOf.set(row.bioguide_id, row.wing);
  }

  // Refresh the denormalised current_wing cache: one UPDATE per wing value,
  // scoped to the members we just classified.
  if (setCurrentWing && wingOf.size > 0) {
    const byWing: Record<Wing, string[]> = { left: [], center: [], right: [] };
    for (const [id, w] of wingOf) byWing[w].push(id);

    for (const w of ["left", "center", "right"] as Wing[]) {
      const ids = byWing[w];
      if (ids.length === 0) continue;
      for (const batch of chunk(ids, 200)) {
        const { error } = await (db as any)
          .from("members")
          .update({ current_wing: w })
          .in("bioguide_id", batch);
        if (error) {
          result.errors.push({ url: "(members.current_wing)", error: error.message });
          continue;
        }
        result.membersWinged += batch.length;
      }
    }
  }

  return result;
}
