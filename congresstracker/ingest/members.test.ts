import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMemberName,
  mapParty,
  mapChamber,
  extractTerms,
  determineChamber,
  transformMember,
  transformTerms,
  ingestMembers,
  type ApiMemberListItem,
  type ApiTermItem,
  type MemberRow,
  type TermRow,
} from "./members.ts";
import { CongressClient } from "./_client.ts";

// ---------------------------------------------------------------------------
// parseMemberName
// ---------------------------------------------------------------------------

test("parseMemberName: standard inverted format", () => {
  const r = parseMemberName("Smith, John");
  assert.equal(r.last, "Smith");
  assert.equal(r.first, "John");
  assert.equal(r.full, "John Smith");
});

test("parseMemberName: first name has middle", () => {
  const r = parseMemberName("Abraham, Ralph Lee");
  assert.equal(r.last, "Abraham");
  assert.equal(r.first, "Ralph Lee");
  assert.equal(r.full, "Ralph Lee Abraham");
});

test("parseMemberName: hyphenated last name", () => {
  const r = parseMemberName("Garcia-Navarro, Luis");
  assert.equal(r.last, "Garcia-Navarro");
  assert.equal(r.first, "Luis");
});

test("parseMemberName: no comma falls back gracefully", () => {
  const r = parseMemberName("Pelosi");
  assert.equal(r.last, "Pelosi");
  assert.equal(r.first, "");
  assert.equal(r.full, "Pelosi");
});

test("parseMemberName: trims whitespace", () => {
  const r = parseMemberName("  Baldwin , Tammy  ");
  assert.equal(r.last, "Baldwin");
  assert.equal(r.first, "Tammy");
});

test("parseMemberName: suffix in name", () => {
  const r = parseMemberName("Young, Donald E., Jr.");
  assert.equal(r.last, "Young");
  assert.equal(r.first, "Donald E., Jr."); // everything after the first comma
});

// ---------------------------------------------------------------------------
// mapParty
// ---------------------------------------------------------------------------

test("mapParty: Republican variants", () => {
  assert.equal(mapParty("Republican"), "R");
  assert.equal(mapParty("republican"), "R");
  assert.equal(mapParty("Republican Party"), "R");
});

test("mapParty: Democratic variants", () => {
  assert.equal(mapParty("Democratic"), "D");
  assert.equal(mapParty("Democrat"), "D");
  assert.equal(mapParty("democratic party"), "D");
});

test("mapParty: Independent variants", () => {
  assert.equal(mapParty("Independent"), "I");
  assert.equal(mapParty("Independent Democrat"), "ID");
});

test("mapParty: Libertarian", () => {
  assert.equal(mapParty("Libertarian"), "L");
});

test("mapParty: unknown becomes Other", () => {
  assert.equal(mapParty("Green"), "Other");
  assert.equal(mapParty("Constitution"), "Other");
});

test("mapParty: undefined/empty returns null", () => {
  assert.equal(mapParty(undefined), null);
  assert.equal(mapParty(""), null);
});

// ---------------------------------------------------------------------------
// mapChamber
// ---------------------------------------------------------------------------

test("mapChamber: House of Representatives", () => {
  assert.equal(mapChamber("House of Representatives"), "house");
  assert.equal(mapChamber("house"), "house");
  assert.equal(mapChamber("H"), "house");
});

test("mapChamber: Senate", () => {
  assert.equal(mapChamber("Senate"), "senate");
  assert.equal(mapChamber("senate"), "senate");
  assert.equal(mapChamber("S"), "senate");
});

test("mapChamber: unknown returns null", () => {
  assert.equal(mapChamber("Joint"), null);
  assert.equal(mapChamber(undefined), null);
});

// ---------------------------------------------------------------------------
// extractTerms
// ---------------------------------------------------------------------------

test("extractTerms: wrapped format { item: [...] }", () => {
  const terms = extractTerms({ item: [{ congress: 118, chamber: "Senate" }] });
  assert.equal(terms.length, 1);
  assert.equal(terms[0].congress, 118);
});

test("extractTerms: bare array format", () => {
  const terms = extractTerms([{ congress: 117 }, { congress: 118 }]);
  assert.equal(terms.length, 2);
});

test("extractTerms: undefined returns empty array", () => {
  assert.deepEqual(extractTerms(undefined), []);
});

test("extractTerms: empty wrapper returns empty array", () => {
  assert.deepEqual(extractTerms({}), []);
});

// ---------------------------------------------------------------------------
// determineChamber
// ---------------------------------------------------------------------------

test("determineChamber: picks most recent congress", () => {
  const terms: ApiTermItem[] = [
    { congress: 115, chamber: "House of Representatives" },
    { congress: 119, chamber: "Senate" },
    { congress: 117, chamber: "House of Representatives" },
  ];
  assert.equal(determineChamber(terms), "senate");
});

test("determineChamber: empty terms returns null", () => {
  assert.equal(determineChamber([]), null);
});

// ---------------------------------------------------------------------------
// transformMember
// ---------------------------------------------------------------------------

const sampleItem: ApiMemberListItem = {
  bioguideId: "B001230",
  name: "Baldwin, Tammy",
  partyName: "Democratic",
  state: "WI",
  url: "https://api.congress.gov/v3/member/B001230",
  updateDate: "2024-01-15",
  depiction: { imageUrl: "https://www.congress.gov/img/member/b001230_200.jpg" },
  terms: {
    item: [
      { congress: 118, chamber: "Senate", startYear: 2023, endYear: 2025 },
      { congress: 116, chamber: "Senate", startYear: 2019, endYear: 2021 },
    ],
  },
};

test("transformMember: maps all fields correctly", () => {
  const row: MemberRow = transformMember(sampleItem);
  assert.equal(row.bioguide_id, "B001230");
  assert.equal(row.first_name, "Tammy");
  assert.equal(row.last_name, "Baldwin");
  assert.equal(row.full_name, "Tammy Baldwin");
  assert.equal(row.party, "D");
  assert.equal(row.state, "WI");
  assert.equal(row.current_chamber, "senate");
  assert.equal(row.image_url, "https://www.congress.gov/img/member/b001230_200.jpg");
  assert.equal(row.congress_url, "https://api.congress.gov/v3/member/B001230");
  assert.ok(row.source_updated_at?.startsWith("2024-01-15"));
});

test("transformMember: missing optional fields are null", () => {
  const minimal: ApiMemberListItem = { bioguideId: "X000001", name: "Doe, Jane" };
  const row = transformMember(minimal);
  assert.equal(row.party, null);
  assert.equal(row.state, null);
  assert.equal(row.current_chamber, null);
  assert.equal(row.image_url, null);
  assert.equal(row.congress_url, null);
  assert.equal(row.source_updated_at, null);
});

// ---------------------------------------------------------------------------
// transformTerms
// ---------------------------------------------------------------------------

test("transformTerms: produces correct rows", () => {
  const terms: ApiTermItem[] = [
    { congress: 118, chamber: "Senate", startYear: 2023, endYear: 2025, partyName: "Democratic" },
    { congress: 116, chamber: "Senate", startYear: 2019, endYear: 2021 },
  ];
  const rows: TermRow[] = transformTerms("B001230", terms, "WI");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    bioguide_id: "B001230",
    congress: 118,
    chamber: "senate",
    state: "WI",
    district: null,
    party: "D",
    start_year: 2023,
    end_year: 2025,
  });
});

test("transformTerms: skips terms missing congress or valid chamber", () => {
  const terms: ApiTermItem[] = [
    { chamber: "Senate" }, // no congress
    { congress: 118 }, // no chamber
    { congress: 119, chamber: "Joint Committee" }, // unrecognised chamber
    { congress: 118, chamber: "House of Representatives" }, // valid
  ];
  const rows = transformTerms("X000001", terms, null);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].congress, 118);
  assert.equal(rows[0].chamber, "house");
});

test("transformTerms: House member includes district", () => {
  const terms: ApiTermItem[] = [
    { congress: 118, chamber: "House of Representatives", district: 5 },
  ];
  const rows = transformTerms("A000374", terms, "LA");
  assert.equal(rows[0].district, 5);
  assert.equal(rows[0].state, "LA");
});

// ---------------------------------------------------------------------------
// ingestMembers — integration test with stubbed client and DB
// ---------------------------------------------------------------------------

/** Minimal stub of the Supabase fluent query builder. */
function makeDbStub(opts: {
  memberUpsertError?: string;
  termDeleteError?: string;
  termInsertError?: string;
} = {}) {
  const memberUpserts: object[][] = [];
  const termDeletes: string[][] = [];
  const termInserts: object[][] = [];

  // Each call to .from() returns a builder. We chain .upsert(), .delete(),
  // .insert(), .in() off it and always settle with { error: null }.
  function makeBuilder(table: string): any {
    const builder: any = {
      upsert(rows: object[]) {
        if (table === "members") memberUpserts.push(rows);
        return {
          then: (res: any) =>
            Promise.resolve(
              opts.memberUpsertError
                ? { error: { message: opts.memberUpsertError } }
                : { error: null }
            ).then(res),
        };
      },
      delete() {
        return {
          in(col: string, ids: string[]) {
            if (table === "terms") termDeletes.push(ids);
            return {
              then: (res: any) =>
                Promise.resolve(
                  opts.termDeleteError
                    ? { error: { message: opts.termDeleteError } }
                    : { error: null }
                ).then(res),
            };
          },
        };
      },
      insert(rows: object[]) {
        if (table === "terms") termInserts.push(rows);
        return {
          then: (res: any) =>
            Promise.resolve(
              opts.termInsertError
                ? { error: { message: opts.termInsertError } }
                : { error: null }
            ).then(res),
        };
      },
    };
    return builder;
  }

  const db: any = { from: (t: string) => makeBuilder(t) };
  return { db, memberUpserts, termDeletes, termInserts };
}

/** Build a CongressClient that yields a fixed list of members. */
function makeClientStub(members: ApiMemberListItem[]): CongressClient {
  let i = 0;
  const fetchFn = (async (_url: string) => {
    const offset = Number(new URL(_url).searchParams.get("offset") ?? 0);
    const limit = Number(new URL(_url).searchParams.get("limit") ?? 250);
    const slice = members.slice(offset, offset + limit);
    return new Response(
      JSON.stringify({
        members: slice,
        pagination: { count: members.length },
      }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;

  return new CongressClient({
    apiKey: "TEST",
    fetchFn,
    now: () => ++i * 1000,
    sleep: async () => {},
    random: () => 0,
  });
}

const twoMembers: ApiMemberListItem[] = [
  {
    bioguideId: "B001230",
    name: "Baldwin, Tammy",
    partyName: "Democratic",
    state: "WI",
    url: "https://api.congress.gov/v3/member/B001230",
    updateDate: "2024-01-15",
    terms: { item: [{ congress: 118, chamber: "Senate", startYear: 2023 }] },
  },
  {
    bioguideId: "A000374",
    name: "Abraham, Ralph Lee",
    partyName: "Republican",
    state: "LA",
    district: 5,
    url: "https://api.congress.gov/v3/member/A000374",
    updateDate: "2023-11-09",
    terms: { item: [{ congress: 118, chamber: "House of Representatives", district: 5, startYear: 2023 }] },
  },
];

test("ingestMembers: upserts members and terms, returns correct counts", async () => {
  const { db, memberUpserts, termDeletes, termInserts } = makeDbStub();
  const client = makeClientStub(twoMembers);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "service-key",
    client,
    db,
  });

  assert.equal(result.membersUpserted, 2);
  assert.equal(result.termsProcessed, 2);
  assert.equal(result.errors.length, 0);

  // One member upsert batch (both members in one batch of 100)
  assert.equal(memberUpserts.length, 1);
  assert.equal(memberUpserts[0].length, 2);

  // Term delete and insert each called once
  assert.equal(termDeletes.length, 1);
  assert.deepEqual(termDeletes[0].sort(), ["A000374", "B001230"]);
  assert.equal(termInserts.length, 1);
  assert.equal(termInserts[0].length, 2);
});

test("ingestMembers: member upsert error is recorded per member", async () => {
  const { db } = makeDbStub({ memberUpsertError: "constraint violation" });
  const client = makeClientStub(twoMembers);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "key",
    client,
    db,
  });

  assert.equal(result.membersUpserted, 0);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((e) => e.error.includes("constraint violation")));
});

test("ingestMembers: term delete error is recorded, terms not inserted", async () => {
  const { db, termInserts } = makeDbStub({ termDeleteError: "permission denied" });
  const client = makeClientStub(twoMembers);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "key",
    client,
    db,
  });

  assert.equal(result.membersUpserted, 2);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.every((e) => e.error.includes("terms delete")));
});

test("ingestMembers: maxItems limits total processed", async () => {
  const { db, memberUpserts } = makeDbStub();
  const client = makeClientStub(twoMembers);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "key",
    client,
    db,
    maxItems: 1,
  });

  assert.equal(result.membersUpserted, 1);
  assert.equal(memberUpserts[0].length, 1);
});

test("ingestMembers: empty response produces zero counts, no errors", async () => {
  const { db } = makeDbStub();
  const client = makeClientStub([]);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "key",
    client,
    db,
  });

  assert.equal(result.membersUpserted, 0);
  assert.equal(result.termsProcessed, 0);
  assert.equal(result.errors.length, 0);
});

test("ingestMembers: member with no valid terms upserts member but zero term rows", async () => {
  const noTermsMember: ApiMemberListItem[] = [
    { bioguideId: "X000001", name: "Doe, John", terms: { item: [] } },
  ];
  const { db, termInserts } = makeDbStub();
  const client = makeClientStub(noTermsMember);

  const result = await ingestMembers({
    apiKey: "TEST",
    supabaseUrl: "https://x.supabase.co",
    supabaseServiceKey: "key",
    client,
    db,
  });

  assert.equal(result.membersUpserted, 1);
  assert.equal(result.termsProcessed, 0);
  assert.equal(termInserts.length, 0);
  assert.equal(result.errors.length, 0);
});
