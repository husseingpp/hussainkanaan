import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePromiseSeed,
  loadPromiseSeeds,
  ingestPromises,
  type PromiseSeed,
} from "./promises.ts";

// ---------------------------------------------------------------------------
// validatePromiseSeed
// ---------------------------------------------------------------------------

test("validatePromiseSeed accepts a minimal unverified promise", () => {
  const res = validatePromiseSeed({
    bioguide_id: "A000001",
    text: "Will introduce a transparency bill in the first 100 days.",
    source_url: "https://example.org/promise",
  });
  assert.equal(res.ok, true);
  assert.equal(res.value!.status, "unverified");
  assert.equal(res.value!.reviewed_by, null);
  assert.equal(res.value!.reviewed_at, null);
});

test("validatePromiseSeed requires bioguide_id, text, and source_url", () => {
  const res = validatePromiseSeed({ text: "  ", source_url: "" });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("bioguide_id")));
  assert.ok(res.errors.some((e) => e.includes("text")));
  assert.ok(res.errors.some((e) => e.includes("source_url")));
});

test("validatePromiseSeed rejects an unknown status", () => {
  const res = validatePromiseSeed({
    bioguide_id: "A000001",
    text: "x",
    source_url: "https://e.org",
    status: "fulfilled",
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("valid promise_status")));
});

test("validatePromiseSeed: a resolved status needs reviewer AND evidence", () => {
  const res = validatePromiseSeed({
    bioguide_id: "A000001",
    text: "x",
    source_url: "https://e.org",
    status: "broken",
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("status_source_url")));
  assert.ok(res.errors.some((e) => e.includes("reviewed_by")));
});

test("validatePromiseSeed accepts a resolved status with reviewer + evidence", () => {
  const res = validatePromiseSeed({
    bioguide_id: "A000001",
    text: "Promised to vote against the bill.",
    source_url: "https://example.org/promise",
    status: "broken",
    status_rationale: "Voted Yea on roll call 123.",
    status_source_url: "https://clerk.house.gov/evs/2023/roll123.xml",
    reviewed_by: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(res.ok, true);
  assert.equal(res.value!.status, "broken");
  // reviewed_at auto-filled when a resolved status omits it.
  assert.ok(res.value!.reviewed_at);
});

test("validatePromiseSeed trims fields and nulls empty optionals", () => {
  const res = validatePromiseSeed({
    bioguide_id: " A000001 ",
    text: "  hello  ",
    source_url: " https://e.org ",
    topic: "   ",
  });
  assert.equal(res.value!.bioguide_id, "A000001");
  assert.equal(res.value!.text, "hello");
  assert.equal(res.value!.source_url, "https://e.org");
  assert.equal(res.value!.topic, null);
});

// ---------------------------------------------------------------------------
// loadPromiseSeeds
// ---------------------------------------------------------------------------

test("loadPromiseSeeds partitions valid rows from rejections", () => {
  const seeds: PromiseSeed[] = [
    { bioguide_id: "A000001", text: "ok", source_url: "https://e.org" },
    { text: "missing id and source" },
  ];
  const { rows, rejected } = loadPromiseSeeds(seeds);
  assert.equal(rows.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].index, 1);
});

// ---------------------------------------------------------------------------
// ingestPromises (integration with a fake db)
// ---------------------------------------------------------------------------

function fakeDb(knownIds: string[]) {
  const inserts: any[][] = [];
  const upserts: any[][] = [];
  const client: any = {
    from(table: string) {
      if (table === "members") {
        return {
          select: () => ({
            range: () =>
              Promise.resolve({
                data: knownIds.map((bioguide_id) => ({ bioguide_id })),
                error: null,
              }),
          }),
        };
      }
      if (table === "promises") {
        return {
          upsert(rows: any[]) {
            upserts.push(rows);
            return Promise.resolve({ error: null });
          },
          insert(rows: any[]) {
            inserts.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserts, upserts };
}

test("ingestPromises skips unknown members and reports rejected seeds", async () => {
  const { client, inserts, upserts } = fakeDb(["A000001"]);
  const result = await ingestPromises({
    supabaseUrl: "x",
    supabaseServiceKey: "y",
    db: client,
    seeds: [
      // valid, known member, no id -> insert
      { bioguide_id: "A000001", text: "p1", source_url: "https://e.org/1" },
      // valid, known member, with id -> upsert
      {
        id: "22222222-2222-2222-2222-222222222222",
        bioguide_id: "A000001",
        text: "p2",
        source_url: "https://e.org/2",
      },
      // valid shape but member not in DB -> skipped
      { bioguide_id: "Z999999", text: "p3", source_url: "https://e.org/3" },
      // invalid -> rejected
      { text: "no source" },
    ],
  });

  assert.equal(result.upserted, 2);
  assert.equal(result.skippedUnknownMember, 1);
  assert.equal(result.rejected, 1);
  assert.equal(inserts.flat().length, 1);
  assert.equal(upserts.flat().length, 1);
});

test("ingestPromises never inserts a fabricated verdict (resolved w/o evidence is rejected)", async () => {
  const { client, inserts, upserts } = fakeDb(["A000001"]);
  const result = await ingestPromises({
    supabaseUrl: "x",
    supabaseServiceKey: "y",
    db: client,
    seeds: [
      {
        bioguide_id: "A000001",
        text: "Promised X",
        source_url: "https://e.org",
        status: "broken", // no reviewer, no evidence
      },
    ],
  });
  assert.equal(result.upserted, 0);
  assert.equal(result.rejected, 1);
  assert.equal(inserts.flat().length, 0);
  assert.equal(upserts.flat().length, 0);
});
