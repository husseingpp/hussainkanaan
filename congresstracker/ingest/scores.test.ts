import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWing,
  mapVoteviewChamber,
  voteviewMembersUrl,
  parseCsv,
  parseVoteviewMembers,
  toAlignmentRows,
  ingestScores,
  type VoteviewMember,
} from "./scores.ts";

// ---------------------------------------------------------------------------
// Sample Voteview CSV (real-shaped, trimmed columns)
// ---------------------------------------------------------------------------

// Header order intentionally differs from the access order to prove we key by
// name, not position. bioname is quoted because it contains a comma.
const HOUSE_CSV = `congress,chamber,icpsr,state_abbrev,party_code,bioname,bioguide_id,nominate_dim1,nominate_dim2
118,House,20301,NY,100,"OCASIO-CORTEZ, Alexandria",O000172,-0.731,0.142
118,House,21500,GA,200,"GREENE, Marjorie Taylor",G000596,0.812,-0.301
118,House,99999,TX,328,"CENTRIST, Sam",C000777,0.103,0.0
118,House,12345,CA,100,"NOSCORE, Pat",N000111,,
118,House,54321,FL,200,"NOTINDB, Chris",Z000999,0.55,0.1
118,Senate,40300,VT,328,"SANDERS, Bernie",S000033,-0.522,-0.012`;

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

test("parseCsv handles quoted fields with embedded commas", () => {
  const rows = parseCsv(`a,b,c\n1,"hello, world",3`);
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "hello, world", "3"],
  ]);
});

test("parseCsv handles escaped (doubled) quotes", () => {
  const rows = parseCsv(`name\n"She said ""hi"""`);
  assert.deepEqual(rows, [["name"], ['She said "hi"']]);
});

test("parseCsv handles CRLF line endings and a missing final newline", () => {
  const rows = parseCsv("a,b\r\n1,2\r\n3,4");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
    ["3", "4"],
  ]);
});

test("parseCsv drops fully blank lines", () => {
  const rows = parseCsv("a,b\n\n1,2\n\n");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

// ---------------------------------------------------------------------------
// classifyWing
// ---------------------------------------------------------------------------

test("classifyWing buckets by the documented symmetric cutoff", () => {
  assert.equal(classifyWing(-0.5), "left");
  assert.equal(classifyWing(0.5), "right");
  assert.equal(classifyWing(0), "center");
  assert.equal(classifyWing(0.1), "center");
  assert.equal(classifyWing(-0.1), "center");
  // Boundaries are inclusive of left/right.
  assert.equal(classifyWing(-0.25), "left");
  assert.equal(classifyWing(0.25), "right");
});

test("classifyWing respects a custom threshold", () => {
  assert.equal(classifyWing(0.3, 0.5), "center");
  assert.equal(classifyWing(0.6, 0.5), "right");
});

// ---------------------------------------------------------------------------
// mapVoteviewChamber + URL
// ---------------------------------------------------------------------------

test("mapVoteviewChamber maps House/Senate and rejects others", () => {
  assert.equal(mapVoteviewChamber("House"), "house");
  assert.equal(mapVoteviewChamber("Senate"), "senate");
  assert.equal(mapVoteviewChamber("President"), null);
  assert.equal(mapVoteviewChamber(undefined), null);
});

test("voteviewMembersUrl builds per-congress chamber URLs", () => {
  assert.equal(
    voteviewMembersUrl(118, "house"),
    "https://voteview.com/static/data/out/members/H118_members.csv",
  );
  assert.equal(
    voteviewMembersUrl(118, "senate"),
    "https://voteview.com/static/data/out/members/S118_members.csv",
  );
});

// ---------------------------------------------------------------------------
// parseVoteviewMembers
// ---------------------------------------------------------------------------

test("parseVoteviewMembers reads columns by name regardless of order", () => {
  const members = parseVoteviewMembers(HOUSE_CSV);
  assert.equal(members.length, 6);
  const aoc = members[0];
  assert.equal(aoc.bioguideId, "O000172");
  assert.equal(aoc.congress, 118);
  assert.equal(aoc.chamber, "house");
  assert.equal(aoc.bioname, "OCASIO-CORTEZ, Alexandria");
  assert.equal(aoc.dim1, -0.731);
  assert.equal(aoc.dim2, 0.142);
});

test("parseVoteviewMembers leaves a missing score as null (never 0)", () => {
  const members = parseVoteviewMembers(HOUSE_CSV);
  const noScore = members.find((m) => m.bioguideId === "N000111");
  assert.ok(noScore);
  assert.equal(noScore!.dim1, null);
  assert.equal(noScore!.dim2, null);
});

// ---------------------------------------------------------------------------
// toAlignmentRows
// ---------------------------------------------------------------------------

const KNOWN = new Set(["O000172", "G000596", "C000777", "N000111", "S000033"]);

test("toAlignmentRows classifies, sources, and skips correctly", () => {
  const members = parseVoteviewMembers(HOUSE_CSV);
  const url = "https://voteview.com/static/data/out/members/H118_members.csv";
  const { rows, skippedNoScore, skippedUnknownMember } = toAlignmentRows(
    members,
    { sourceUrl: url, knownMembers: KNOWN },
  );

  // O000172 (left), G000596 (right), C000777 (center), S000033 (left).
  // N000111 skipped (no score); Z000999 skipped (not in members).
  assert.equal(rows.length, 4);
  assert.equal(skippedNoScore, 1);
  assert.equal(skippedUnknownMember, 1);

  const byId = Object.fromEntries(rows.map((r) => [r.bioguide_id, r]));
  assert.equal(byId["O000172"].wing, "left");
  assert.equal(byId["G000596"].wing, "right");
  assert.equal(byId["C000777"].wing, "center");
  assert.equal(byId["S000033"].wing, "left");

  // Every row carries the source + methodology link + raw score (hard rule 3).
  for (const r of rows) {
    assert.equal(r.source_url, url);
    assert.equal(r.methodology_url, "/methodology");
    assert.equal(r.metric, "dw-nominate");
    assert.notEqual(r.dimension1, null);
  }
});

test("toAlignmentRows counts rows with no bioguide id", () => {
  const members: VoteviewMember[] = [
    {
      bioguideId: null,
      congress: 118,
      chamber: "house",
      party: "100",
      state: "CA",
      bioname: "MYSTERY",
      dim1: -0.4,
      dim2: 0,
    },
  ];
  const { rows, skippedNoBioguide } = toAlignmentRows(members, {
    sourceUrl: "x",
  });
  assert.equal(rows.length, 0);
  assert.equal(skippedNoBioguide, 1);
});

test("toAlignmentRows de-dupes on (bioguide, congress, metric)", () => {
  const one: VoteviewMember = {
    bioguideId: "O000172",
    congress: 118,
    chamber: "house",
    party: "100",
    state: "NY",
    bioname: "AOC",
    dim1: -0.7,
    dim2: 0,
  };
  const { rows } = toAlignmentRows([one, { ...one, dim1: -0.6 }], {
    sourceUrl: "x",
  });
  assert.equal(rows.length, 1);
});

// ---------------------------------------------------------------------------
// ingestScores (integration with injected fetch + fake db)
// ---------------------------------------------------------------------------

/** A tiny fake Supabase client capturing upserts and updates. */
function fakeDb(knownIds: string[]) {
  const upserts: any[][] = [];
  const wingUpdates: Array<{ wing: string; ids: string[] }> = [];

  const client: any = {
    from(table: string) {
      if (table === "members") {
        return {
          // loadKnownMembers path
          select() {
            return {
              range() {
                return Promise.resolve({
                  data: knownIds.map((bioguide_id) => ({ bioguide_id })),
                  error: null,
                });
              },
            };
          },
          // current_wing refresh path
          update(patch: { current_wing: string }) {
            return {
              in(_col: string, ids: string[]) {
                wingUpdates.push({ wing: patch.current_wing, ids });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "alignment_scores") {
        return {
          upsert(rows: any[]) {
            upserts.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { client, upserts, wingUpdates };
}

test("ingestScores fetches, upserts scores, and refreshes current_wing", async () => {
  const { client, upserts, wingUpdates } = fakeDb([
    "O000172",
    "G000596",
    "C000777",
    "N000111",
    "S000033",
  ]);

  const fetched: string[] = [];
  const fetchText = async (url: string) => {
    fetched.push(url);
    // House file gets the House rows; Senate file gets the Senate row.
    return { ok: true, status: 200, text: HOUSE_CSV };
  };

  const result = await ingestScores({
    supabaseUrl: "x",
    supabaseServiceKey: "y",
    congress: 118,
    chambers: ["house"],
    db: client,
    fetchText,
  });

  assert.equal(fetched.length, 1);
  assert.equal(fetched[0], voteviewMembersUrl(118, "house"));

  // 4 scored House members upserted (AOC, Greene, Centrist, Sanders is Senate
  // so filtered out; NoScore skipped; NotInDB skipped).
  const allUpserted = upserts.flat();
  assert.equal(result.scoresUpserted, 3);
  assert.equal(allUpserted.length, 3);
  assert.equal(result.skippedNoScore, 1);
  assert.equal(result.skippedUnknownMember, 1);

  // current_wing refreshed: 2 left? no — House scored = AOC(left), Greene(right),
  // Centrist(center). So one update per non-empty wing.
  assert.equal(result.membersWinged, 3);
  const wings = wingUpdates.map((w) => w.wing).sort();
  assert.deepEqual(wings, ["center", "left", "right"]);
});

test("ingestScores can skip the current_wing refresh", async () => {
  const { client, wingUpdates } = fakeDb(["O000172"]);
  const result = await ingestScores({
    supabaseUrl: "x",
    supabaseServiceKey: "y",
    congress: 118,
    chambers: ["house"],
    db: client,
    fetchText: async () => ({ ok: true, status: 200, text: HOUSE_CSV }),
    setCurrentWing: false,
  });
  assert.equal(wingUpdates.length, 0);
  assert.equal(result.membersWinged, 0);
});

test("ingestScores records an error when a chamber file is unavailable", async () => {
  const { client } = fakeDb(["O000172"]);
  const result = await ingestScores({
    supabaseUrl: "x",
    supabaseServiceKey: "y",
    congress: 118,
    chambers: ["house"],
    db: client,
    fetchText: async () => ({ ok: false, status: 404, text: "" }),
  });
  assert.equal(result.scoresUpserted, 0);
  assert.equal(result.errors.length, 1);
});
