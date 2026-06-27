/**
 * Phase 6 — Votes ingestion. The messiest module; parsing is isolated and
 * tested hard (see votes.test.ts).
 *
 * Congress.gov does NOT expose clean member-level roll-call votes, so positions
 * come from the official roll-call XML:
 *   - House: https://clerk.house.gov/evs/{year}/roll{NNN}.xml
 *   - Senate: https://www.senate.gov/legislative/LIS/roll_call_votes/
 *             vote{congress}{session}/vote_{congress}_{session}_{NNNNN}.xml
 *
 * Two formats, two id schemes:
 *   - House XML identifies voters by Bioguide id (`legislator name-id="A000374"`).
 *   - Senate XML identifies voters by LIS id (`<lis_member_id>S354`), NOT
 *     Bioguide. We resolve Senate voters through a deterministic LIS->Bioguide
 *     crosswalk (members.lis_id). A vote with no crosswalk match is SKIPPED,
 *     never attached to a name-guessed member — defamation is the top risk.
 *
 * Hard rule: every vote row carries a source_url (the XML it was parsed from).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import type { Database, Chamber, VotePosition } from "../lib/database.types.ts";

// ---------------------------------------------------------------------------
// Normalized parse output
// ---------------------------------------------------------------------------

export type IdType = "bioguide" | "lis";

export interface ParsedVote {
  /** Bioguide id (House) or LIS id (Senate). */
  memberId: string;
  idType: IdType;
  position: VotePosition;
  party?: string;
  state?: string;
  name?: string;
}

export interface ParsedRollCall {
  congress: number;
  chamber: Chamber;
  session: number | null;
  rollCall: number;
  voteDate: string | null; // ISO yyyy-mm-dd
  question: string | null;
  description: string | null;
  /** Raw bill reference as printed, e.g. "H R 3076", "H RES 5". */
  legisNum: string | null;
  votes: ParsedVote[];
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Map any roll-call vote token to our enum. House uses Yea/Nay (or Aye/No for
 * "AYE-AND-NO" votes) / Present / "Not Voting"; Senate uses Yea/Nay/Present/
 * "Not Voting" too. Unknown tokens default to not_voting (never invented).
 */
export function normalizePosition(raw: string | undefined): VotePosition {
  const v = (raw ?? "").trim().toLowerCase();
  switch (v) {
    case "yea":
    case "aye":
    case "yes":
    case "guilty":
      return "yea";
    case "nay":
    case "no":
    case "not guilty":
      return "nay";
    case "present":
    case "present, giving live pair":
      return "present";
    case "not voting":
    case "not voting/not present":
    case "":
      return "not_voting";
    default:
      return "not_voting";
  }
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Parse a House action-date like "9-Jan-2023" into ISO "2023-01-09". */
export function parseHouseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  }
  const day = m[1].padStart(2, "0");
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${day}`;
}

/** Parse a Senate vote_date like "February 9, 2023" into ISO "2023-02-09". */
export function parseSenateDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** "1st" -> 1, "2nd" -> 2, "1" -> 1. */
export function parseSession(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) : null;
}

const LEGIS_TYPE_MAP: Array<[RegExp, string]> = [
  [/^H\s?R$/i, "hr"],
  [/^H\s?RES$/i, "hres"],
  [/^H\s?J\s?RES$/i, "hjres"],
  [/^H\s?CON\s?RES$/i, "hconres"],
  [/^S$/i, "s"],
  [/^S\s?RES$/i, "sres"],
  [/^S\s?J\s?RES$/i, "sjres"],
  [/^S\s?CON\s?RES$/i, "sconres"],
];

/**
 * Turn a printed bill reference ("H R 3076", "H RES 5", "S J RES 12") plus a
 * congress number into our canonical bill id "{congress}-{type}-{number}", or
 * null when the reference isn't a parseable bill (procedural votes, quorum
 * calls, nominations, etc.).
 */
export function billIdFromLegisNum(
  legisNum: string | null | undefined,
  congress: number,
): string | null {
  if (!legisNum) return null;
  const cleaned = legisNum.trim().replace(/\s+/g, " ");
  // Split into the type words and the trailing number.
  const m = cleaned.match(/^([A-Za-z. ]+?)\s*(\d+)$/);
  if (!m) return null;
  const typePart = m[1].replace(/\./g, "").trim().toUpperCase();
  const number = m[2];
  for (const [re, type] of LEGIS_TYPE_MAP) {
    if (re.test(typePart.replace(/\s+/g, " "))) {
      return `${congress}-${type}-${number}`;
    }
  }
  return null;
}

// --- URL builders ---------------------------------------------------------

export function houseRollCallUrl(year: number, roll: number): string {
  return `https://clerk.house.gov/evs/${year}/roll${String(roll).padStart(3, "0")}.xml`;
}

export function senateRollCallUrl(
  congress: number,
  session: number,
  voteNumber: number,
): string {
  const v = String(voteNumber).padStart(5, "0");
  return `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${v}.xml`;
}

// ---------------------------------------------------------------------------
// XML parsers
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false, // keep everything as strings; we coerce explicitly
});

/** Always return an array for a node that may be single or repeated. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "object" && "#text" in (v as object)) {
    return String((v as { "#text": unknown })["#text"]);
  }
  return String(v);
}

/** Parse House Clerk roll-call XML. Voters carry Bioguide ids. */
export function parseHouseRollCall(xml: string): ParsedRollCall {
  const doc = parser.parse(xml);
  const root = doc["rollcall-vote"] ?? {};
  const meta = root["vote-metadata"] ?? {};
  const data = root["vote-data"] ?? {};

  const recorded = asArray<any>(data["recorded-vote"]);
  const votes: ParsedVote[] = [];
  for (const rv of recorded) {
    const leg = rv.legislator ?? {};
    const bioguide = leg["@_name-id"];
    if (!bioguide) continue; // no id -> cannot attribute, skip
    votes.push({
      memberId: String(bioguide),
      idType: "bioguide",
      position: normalizePosition(text(rv.vote)),
      party: leg["@_party"] ? String(leg["@_party"]) : undefined,
      state: leg["@_state"] ? String(leg["@_state"]) : undefined,
      name: text(leg),
    });
  }

  const legisNum = text(meta["legis-num"]) ?? null;

  return {
    congress: Number(text(meta.congress)) || 0,
    chamber: "house",
    session: parseSession(text(meta.session)),
    rollCall: Number(text(meta["rollcall-num"])) || 0,
    voteDate: parseHouseDate(text(meta["action-date"])),
    question: text(meta["vote-question"]) ?? null,
    description: text(meta["vote-desc"]) ?? null,
    legisNum,
    votes,
  };
}

/** Parse Senate LIS roll-call XML. Voters carry LIS ids (not Bioguide). */
export function parseSenateRollCall(xml: string): ParsedRollCall {
  const doc = parser.parse(xml);
  const root = doc["roll_call_vote"] ?? {};
  const membersNode = root.members ?? {};

  const memberList = asArray<any>(membersNode.member);
  const votes: ParsedVote[] = [];
  for (const mem of memberList) {
    const lis = mem.lis_member_id;
    if (!lis) continue;
    votes.push({
      memberId: String(lis),
      idType: "lis",
      position: normalizePosition(text(mem.vote_cast)),
      party: mem.party ? String(mem.party) : undefined,
      state: mem.state ? String(mem.state) : undefined,
      name: text(mem.member_full),
    });
  }

  // Build a printed bill reference from the <document> block if present.
  const docBlock = root.document ?? {};
  let legisNum: string | null = null;
  const docType = text(docBlock.document_type);
  const docNumber = text(docBlock.document_number);
  if (docType && docNumber) legisNum = `${docType} ${docNumber}`;

  return {
    congress: Number(text(root.congress)) || 0,
    chamber: "senate",
    session: parseSession(text(root.session)),
    rollCall: Number(text(root.vote_number)) || 0,
    voteDate: parseSenateDate(text(root.vote_date)),
    question: text(root.vote_question_text) ?? text(root.question) ?? null,
    description: text(root.vote_title) ?? null,
    legisNum,
    votes,
  };
}

// ---------------------------------------------------------------------------
// Transform a parsed roll call into vote rows
// ---------------------------------------------------------------------------

export interface VoteRow {
  bioguide_id: string;
  congress: number;
  chamber: Chamber;
  session: number | null;
  roll_call: number;
  vote_date: string | null;
  question: string | null;
  description: string | null;
  bill_id: string | null;
  position: VotePosition;
  source_url: string;
}

export interface TransformOptions {
  sourceUrl: string;
  /** LIS id -> Bioguide id crosswalk (required to resolve Senate voters). */
  lisToBioguide?: Map<string, string>;
  /** Only keep rows for members we know about (avoids FK errors). */
  knownMembers?: Set<string>;
  /** Override the resolved bill id (else derived from legisNum). */
  billId?: string | null;
}

export interface TransformResult {
  rows: VoteRow[];
  skippedUnresolved: number; // could not map to a bioguide id
  skippedUnknownMember: number; // bioguide not in members table
}

export function toVoteRows(
  parsed: ParsedRollCall,
  opts: TransformOptions,
): TransformResult {
  const billId =
    opts.billId !== undefined
      ? opts.billId
      : billIdFromLegisNum(parsed.legisNum, parsed.congress);

  const rows: VoteRow[] = [];
  let skippedUnresolved = 0;
  let skippedUnknownMember = 0;
  const seen = new Set<string>();

  for (const v of parsed.votes) {
    let bioguide: string | undefined;
    if (v.idType === "bioguide") {
      bioguide = v.memberId;
    } else {
      bioguide = opts.lisToBioguide?.get(v.memberId);
    }
    if (!bioguide) {
      skippedUnresolved += 1;
      continue;
    }
    if (opts.knownMembers && !opts.knownMembers.has(bioguide)) {
      skippedUnknownMember += 1;
      continue;
    }
    // De-dupe on the table's unique key within this roll call.
    if (seen.has(bioguide)) continue;
    seen.add(bioguide);

    rows.push({
      bioguide_id: bioguide,
      congress: parsed.congress,
      chamber: parsed.chamber,
      session: parsed.session,
      roll_call: parsed.rollCall,
      vote_date: parsed.voteDate,
      question: parsed.question,
      description: parsed.description,
      bill_id: billId,
      position: v.position,
      source_url: opts.sourceUrl,
    });
  }

  return { rows, skippedUnresolved, skippedUnknownMember };
}

// ---------------------------------------------------------------------------
// Ingestion entry point
// ---------------------------------------------------------------------------

/** Minimal text-fetch abstraction so the network is injectable in tests. */
export type FetchText = (
  url: string,
) => Promise<{ ok: boolean; status: number; text: string }>;

const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
};

export interface IngestVotesOptions {
  supabaseUrl: string;
  supabaseServiceKey: string;
  chamber: Chamber;
  congress: number;
  session: number;
  /** Calendar year (House URLs are keyed by year). */
  year?: number;
  /** First roll-call number to fetch (default 1). */
  startRoll?: number;
  /** Last roll-call number; if omitted, stop after `maxConsecutiveMisses`. */
  endRoll?: number;
  /** Stop after this many consecutive 404s when endRoll is open. */
  maxConsecutiveMisses?: number;
  /** Only keep votes whose bill exists; default false (bill_id is nullable). */
  filterMissingMembers?: boolean;
  fetchText?: FetchText;
  db?: SupabaseClient<Database>;
  /** Pre-supplied crosswalk + member set (else loaded from the DB). */
  lisToBioguide?: Map<string, string>;
  knownMembers?: Set<string>;
}

export interface VotesIngestResult {
  rollCallsProcessed: number;
  rollCallsMissing: number;
  votesUpserted: number;
  skippedUnresolved: number;
  skippedUnknownMember: number;
  errors: Array<{ url: string; error: string }>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadCrosswalk(
  db: SupabaseClient<Database>,
): Promise<{ lis: Map<string, string>; known: Set<string> }> {
  const lis = new Map<string, string>();
  const known = new Set<string>();
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await (db as any)
      .from("members")
      .select("bioguide_id, lis_id")
      .range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as Array<{ bioguide_id: string; lis_id: string | null }>) {
      known.add(r.bioguide_id);
      if (r.lis_id) lis.set(r.lis_id, r.bioguide_id);
    }
    if (data.length < size) break;
    from += size;
  }
  return { lis, known };
}

export async function ingestVotes(
  opts: IngestVotesOptions,
): Promise<VotesIngestResult> {
  const db =
    opts.db ??
    createClient<Database>(opts.supabaseUrl, opts.supabaseServiceKey, {
      auth: { persistSession: false },
    });
  const fetchText = opts.fetchText ?? defaultFetchText;

  const result: VotesIngestResult = {
    rollCallsProcessed: 0,
    rollCallsMissing: 0,
    votesUpserted: 0,
    skippedUnresolved: 0,
    skippedUnknownMember: 0,
    errors: [],
  };

  let lisToBioguide = opts.lisToBioguide;
  let knownMembers = opts.knownMembers;
  if (!lisToBioguide || !knownMembers) {
    const cw = await loadCrosswalk(db);
    lisToBioguide = lisToBioguide ?? cw.lis;
    knownMembers = knownMembers ?? cw.known;
  }

  const year = opts.year ?? 0;
  const startRoll = opts.startRoll ?? 1;
  const maxMisses = opts.maxConsecutiveMisses ?? 5;
  let consecutiveMisses = 0;

  for (let roll = startRoll; ; roll++) {
    if (opts.endRoll !== undefined && roll > opts.endRoll) break;

    const url =
      opts.chamber === "house"
        ? houseRollCallUrl(year, roll)
        : senateRollCallUrl(opts.congress, opts.session, roll);

    let fetched: { ok: boolean; status: number; text: string };
    try {
      fetched = await fetchText(url);
    } catch (err) {
      result.errors.push({ url, error: (err as Error).message });
      consecutiveMisses += 1;
      if (opts.endRoll === undefined && consecutiveMisses >= maxMisses) break;
      continue;
    }

    if (!fetched.ok || !fetched.text.trim()) {
      result.rollCallsMissing += 1;
      consecutiveMisses += 1;
      if (opts.endRoll === undefined && consecutiveMisses >= maxMisses) break;
      continue;
    }
    consecutiveMisses = 0;

    let parsed: ParsedRollCall;
    try {
      parsed =
        opts.chamber === "house"
          ? parseHouseRollCall(fetched.text)
          : parseSenateRollCall(fetched.text);
    } catch (err) {
      result.errors.push({ url, error: `parse: ${(err as Error).message}` });
      continue;
    }

    const { rows, skippedUnresolved, skippedUnknownMember } = toVoteRows(parsed, {
      sourceUrl: url,
      lisToBioguide,
      knownMembers,
    });
    result.skippedUnresolved += skippedUnresolved;
    result.skippedUnknownMember += skippedUnknownMember;
    result.rollCallsProcessed += 1;

    for (const batch of chunk(rows, 100)) {
      if (batch.length === 0) continue;
      const { error } = await (db as any)
        .from("votes")
        .upsert(batch, {
          onConflict: "bioguide_id,congress,chamber,session,roll_call",
        });
      if (error) {
        result.errors.push({ url, error: `vote upsert: ${error.message}` });
        continue;
      }
      result.votesUpserted += batch.length;
    }
  }

  return result;
}
