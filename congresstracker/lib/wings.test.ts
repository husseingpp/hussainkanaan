import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByWing, tallyVotes, tallyPromises, pct } from "./wings.ts";

test("groupByWing splits by current_wing and ignores unclassified", () => {
  const members = [
    { current_wing: "left" as const },
    { current_wing: "right" as const },
    { current_wing: "left" as const },
    { current_wing: null },
    { current_wing: "center" as const },
  ];
  const g = groupByWing(members);
  assert.equal(g.left.length, 2);
  assert.equal(g.center.length, 1);
  assert.equal(g.right.length, 1);
});

test("tallyVotes counts every position and zero-fills the rest", () => {
  const t = tallyVotes([
    { position: "yea" },
    { position: "yea" },
    { position: "nay" },
    { position: "not_voting" },
  ]);
  assert.deepEqual(t, { yea: 2, nay: 1, present: 0, not_voting: 1 });
});

test("tallyPromises counts every status and zero-fills the rest", () => {
  const t = tallyPromises([
    { status: "kept" },
    { status: "broken" },
    { status: "kept" },
    { status: "unverified" },
  ]);
  assert.deepEqual(t, {
    unverified: 1,
    kept: 2,
    broken: 1,
    partial: 0,
    stalled: 0,
  });
});

test("pct rounds and guards divide-by-zero", () => {
  assert.equal(pct(1, 2), 50);
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(0, 0), 0);
  assert.equal(pct(5, 0), 0);
});
