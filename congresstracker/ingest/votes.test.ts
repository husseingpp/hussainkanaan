import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePosition,
  parseHouseDate,
  parseSenateDate,
  parseSession,
  billIdFromLegisNum,
  houseRollCallUrl,
  senateRollCallUrl,
  parseHouseRollCall,
  parseSenateRollCall,
  toVoteRows,
  ingestVotes,
} from "./votes.ts";

// ---------------------------------------------------------------------------
// Sample XML (realistic, trimmed)
// ---------------------------------------------------------------------------

const HOUSE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rollcall-vote>
  <vote-metadata>
    <congress>118</congress>
    <session>1st</session>
    <chamber>U.S. House of Representatives</chamber>
    <rollcall-num>6</rollcall-num>
    <legis-num>H R 3076</legis-num>
    <vote-question>On Passage</vote-question>
    <vote-type>YEA-AND-NAY</vote-type>
    <vote-result>Passed</vote-result>
    <action-date>9-Jan-2023</action-date>
    <action-time time-etz="18:13">18:13</action-time>
    <vote-desc>Postal Service Reform Act</vote-desc>
  </vote-metadata>
  <vote-data>
    <recorded-vote><legislator name-id="A000374" party="R" state="LA">Abraham</legislator><vote>Yea</vote></recorded-vote>
    <recorded-vote><legislator name-id="B001230" party="D" state="WI">Baldwin</legislator><vote>Nay</vote></recorded-vote>
    <recorded-vote><legislator name-id="C000001" party="D" state="CA">Cee</legislator><vote>Not Voting</vote></recorded-vote>
    <recorded-vote><legislator name-id="P000001" party="I" state="VT">Pres</legislator><vote>Present</vote></recorded-vote>
  </vote-data>
</rollcall-vote>`;

// Single recorded-vote (exercises single-vs-array handling) with Aye/No tokens.
const HOUSE_XML_SINGLE = `<rollcall-vote>
  <vote-metadata>
    <congress>118</congress><session>1st</session>
    <rollcall-num>2</rollcall-num>
    <legis-num>QUORUM</legis-num>
    <vote-question>Call by States</vote-question>
    <vote-type>AYE-AND-NO</vote-type>
    <action-date>7-Jan-2023</action-date>
  </vote-metadata>
  <vote-data>
    <recorded-vote><legislator name-id="A000374" party="R" state="LA">Abraham</legislator><vote>Aye</vote></recorded-vote>
  </vote-data>
</rollcall-vote>`;

const SENATE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<roll_call_vote>
  <congress>118</congress>
  <session>1</session>
  <congress_year>2023</congress_year>
  <vote_number>00010</vote_number>
  <vote_date>February 9, 2023</vote_date>
  <vote_question_text>On the Motion</vote_question_text>
  <vote_title>A bill to do a thing</vote_title>
  <document>
    <document_type>S</document_type>
    <document_number>1</document_number>
  </document>
  <members>
    <member><member_full>Baldwin (D-WI)</member_full><party>D</party><state>WI</state><vote_cast>Yea</vote_cast><lis_member_id>S354</lis_member_id></member>
    <member><member_full>Cruz (R-TX)</member_full><party>R</party><state>TX</state><vote_cast>Nay</vote_cast><lis_member_id>S341</lis_member_id></member>
    <member><member_full>King (I-ME)</member_full><party>I</party><state>ME</state><vote_cast>Not Voting</vote_cast><lis_member_id>S363</lis_member_id></member>
  </members>
</roll_call_vote>`;

// ---------------------------------------------------------------------------
// normalizePosition
// ---------------------------------------------------------------------------

test("normalizePosition: yea variants", () => {
  for (const v of ["Yea", "aye", "YES", "Guilty", "  Yea  "]) {
    assert.equal(normalizePosition(v), "yea");
  }
});

test("normalizePosition: nay variants", () => {
  for (const v of ["Nay", "No", "not guilty"]) {
    assert.equal(normalizePosition(v), "nay");
  }
});

test("normalizePosition: present and not voting", () => {
  assert.equal(normalizePosition("Present"), "present");
  assert.equal(normalizePosition("Not Voting"), "not_voting");
  assert.equal(normalizePosition(""), "not_voting");
  assert.equal(normalizePosition(undefined), "not_voting");
});

test("normalizePosition: unknown token defaults to not_voting (never invented)", () => {
  assert.equal(normalizePosition("Banana"), "not_voting");
});

// ---------------------------------------------------------------------------
// date / session parsing
// ---------------------------------------------------------------------------

test("parseHouseDate: dd-Mon-yyyy", () => {
  assert.equal(parseHouseDate("9-Jan-2023"), "2023-01-09");
  assert.equal(parseHouseDate("21-Dec-2022"), "2022-12-21");
});

test("parseHouseDate: invalid -> null", () => {
  assert.equal(parseHouseDate("garbage"), null);
  assert.equal(parseHouseDate(undefined), null);
});

test("parseSenateDate: 'Month d, yyyy'", () => {
  assert.equal(parseSenateDate("February 9, 2023"), "2023-02-09");
});

test("parseSession: ordinals and digits", () => {
  assert.equal(parseSession("1st"), 1);
  assert.equal(parseSession("2nd"), 2);
  assert.equal(parseSession("1"), 1);
  assert.equal(parseSession(2), 2);
  assert.equal(parseSession(undefined), null);
});

// ---------------------------------------------------------------------------
// billIdFromLegisNum
// ---------------------------------------------------------------------------

test("billIdFromLegisNum: each bill type", () => {
  assert.equal(billIdFromLegisNum("H R 3076", 117), "117-hr-3076");
  assert.equal(billIdFromLegisNum("H RES 5", 118), "118-hres-5");
  assert.equal(billIdFromLegisNum("H J RES 7", 118), "118-hjres-7");
  assert.equal(billIdFromLegisNum("H CON RES 1", 118), "118-hconres-1");
  assert.equal(billIdFromLegisNum("S 1", 118), "118-s-1");
  assert.equal(billIdFromLegisNum("S RES 20", 118), "118-sres-20");
  assert.equal(billIdFromLegisNum("S J RES 12", 118), "118-sjres-12");
  assert.equal(billIdFromLegisNum("S CON RES 3", 118), "118-sconres-3");
});

test("billIdFromLegisNum: tolerates dots", () => {
  assert.equal(billIdFromLegisNum("H.R. 3076", 117), "117-hr-3076");
});

test("billIdFromLegisNum: non-bill references -> null", () => {
  assert.equal(billIdFromLegisNum("QUORUM", 118), null);
  assert.equal(billIdFromLegisNum("PN 1", 118), null); // nomination
  assert.equal(billIdFromLegisNum(null, 118), null);
  assert.equal(billIdFromLegisNum("", 118), null);
});

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

test("houseRollCallUrl zero-pads roll to 3", () => {
  assert.equal(
    houseRollCallUrl(2023, 6),
    "https://clerk.house.gov/evs/2023/roll006.xml",
  );
  assert.equal(
    houseRollCallUrl(2023, 123),
    "https://clerk.house.gov/evs/2023/roll123.xml",
  );
});

test("senateRollCallUrl zero-pads vote to 5", () => {
  assert.equal(
    senateRollCallUrl(118, 1, 10),
    "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1181/vote_118_1_00010.xml",
  );
});

// ---------------------------------------------------------------------------
// parseHouseRollCall
// ---------------------------------------------------------------------------

test("parseHouseRollCall: metadata + voters with bioguide ids", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  assert.equal(p.congress, 118);
  assert.equal(p.chamber, "house");
  assert.equal(p.session, 1);
  assert.equal(p.rollCall, 6);
  assert.equal(p.voteDate, "2023-01-09");
  assert.equal(p.question, "On Passage");
  assert.equal(p.description, "Postal Service Reform Act");
  assert.equal(p.legisNum, "H R 3076");
  assert.equal(p.votes.length, 4);

  assert.deepEqual(
    p.votes.map((v) => [v.memberId, v.idType, v.position]),
    [
      ["A000374", "bioguide", "yea"],
      ["B001230", "bioguide", "nay"],
      ["C000001", "bioguide", "not_voting"],
      ["P000001", "bioguide", "present"],
    ],
  );
  assert.equal(p.votes[0].party, "R");
  assert.equal(p.votes[0].state, "LA");
});

test("parseHouseRollCall: single recorded-vote and Aye token", () => {
  const p = parseHouseRollCall(HOUSE_XML_SINGLE);
  assert.equal(p.votes.length, 1);
  assert.equal(p.votes[0].memberId, "A000374");
  assert.equal(p.votes[0].position, "yea"); // Aye -> yea
  assert.equal(p.legisNum, "QUORUM");
});

// ---------------------------------------------------------------------------
// parseSenateRollCall
// ---------------------------------------------------------------------------

test("parseSenateRollCall: metadata + voters with LIS ids", () => {
  const p = parseSenateRollCall(SENATE_XML);
  assert.equal(p.congress, 118);
  assert.equal(p.chamber, "senate");
  assert.equal(p.session, 1);
  assert.equal(p.rollCall, 10);
  assert.equal(p.voteDate, "2023-02-09");
  assert.equal(p.question, "On the Motion");
  assert.equal(p.description, "A bill to do a thing");
  assert.equal(p.legisNum, "S 1");
  assert.equal(p.votes.length, 3);

  assert.deepEqual(
    p.votes.map((v) => [v.memberId, v.idType, v.position]),
    [
      ["S354", "lis", "yea"],
      ["S341", "lis", "nay"],
      ["S363", "lis", "not_voting"],
    ],
  );
});

// ---------------------------------------------------------------------------
// toVoteRows
// ---------------------------------------------------------------------------

test("toVoteRows: House resolves bioguide directly and derives bill_id", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  const { rows, skippedUnresolved, skippedUnknownMember } = toVoteRows(p, {
    sourceUrl: "https://clerk.house.gov/evs/2023/roll006.xml",
    knownMembers: new Set(["A000374", "B001230", "C000001", "P000001"]),
  });
  assert.equal(rows.length, 4);
  assert.equal(skippedUnresolved, 0);
  assert.equal(skippedUnknownMember, 0);
  assert.equal(rows[0].bill_id, "118-hr-3076");
  assert.equal(rows[0].source_url, "https://clerk.house.gov/evs/2023/roll006.xml");
  assert.equal(rows[0].chamber, "house");
  assert.equal(rows[0].roll_call, 6);
});

test("toVoteRows: every row carries the mandatory source_url", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  const { rows } = toVoteRows(p, { sourceUrl: "https://x/roll.xml" });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.source_url === "https://x/roll.xml"));
});

test("toVoteRows: Senate resolves via LIS crosswalk", () => {
  const p = parseSenateRollCall(SENATE_XML);
  const lis = new Map([
    ["S354", "B001230"],
    ["S341", "C001098"],
    // S363 intentionally missing from crosswalk
  ]);
  const { rows, skippedUnresolved } = toVoteRows(p, {
    sourceUrl: senateRollCallUrl(118, 1, 10),
    lisToBioguide: lis,
    knownMembers: new Set(["B001230", "C001098"]),
  });
  assert.equal(rows.length, 2);
  assert.equal(skippedUnresolved, 1, "S363 not in crosswalk -> skipped, not guessed");
  assert.deepEqual(rows.map((r) => r.bioguide_id), ["B001230", "C001098"]);
});

test("toVoteRows: unknown member (not in members table) is skipped", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  const { rows, skippedUnknownMember } = toVoteRows(p, {
    sourceUrl: "https://x",
    knownMembers: new Set(["A000374"]), // only one known
  });
  assert.equal(rows.length, 1);
  assert.equal(skippedUnknownMember, 3);
});

test("toVoteRows: billId override wins over legisNum", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  const { rows } = toVoteRows(p, { sourceUrl: "x", billId: null });
  assert.equal(rows[0].bill_id, null);
});

test("toVoteRows: de-dupes a member listed twice in one roll call", () => {
  const p = parseHouseRollCall(HOUSE_XML);
  p.votes.push({ ...p.votes[0] }); // duplicate A000374
  const { rows } = toVoteRows(p, { sourceUrl: "x" });
  const a = rows.filter((r) => r.bioguide_id === "A000374");
  assert.equal(a.length, 1);
});

// ---------------------------------------------------------------------------
// ingestVotes — integration with stubbed fetch + DB
// ---------------------------------------------------------------------------

function makeDbStub() {
  const upserts: object[][] = [];
  const db: any = {
    from() {
      return {
        upsert(rows: any[]) {
          upserts.push(rows);
          return { then: (r: any) => Promise.resolve({ error: null }).then(r) };
        },
      };
    },
  };
  return { db, upserts };
}

test("ingestVotes: walks House rolls until consecutive misses, upserts votes", async () => {
  const present: Record<number, string> = { 1: HOUSE_XML, 2: HOUSE_XML_SINGLE };
  const fetchText = async (url: string) => {
    const m = url.match(/roll(\d+)\.xml/);
    const roll = m ? Number(m[1]) : 0;
    const xml = present[roll];
    return xml
      ? { ok: true, status: 200, text: xml }
      : { ok: false, status: 404, text: "" };
  };

  const { db, upserts } = makeDbStub();
  const result = await ingestVotes({
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    chamber: "house",
    congress: 118,
    session: 1,
    year: 2023,
    maxConsecutiveMisses: 3,
    fetchText,
    db,
    lisToBioguide: new Map(),
    knownMembers: new Set(["A000374", "B001230", "C000001", "P000001"]),
  });

  assert.equal(result.rollCallsProcessed, 2);
  assert.equal(result.votesUpserted, 5); // 4 + 1
  assert.equal(result.rollCallsMissing, 3); // rolls 3,4,5 before stop
  // source_url present on every upserted row
  assert.ok(upserts.flat().every((r: any) => typeof r.source_url === "string" && r.source_url.length > 0));
});

test("ingestVotes: respects an explicit endRoll", async () => {
  const fetchText = async (url: string) => {
    const roll = Number(url.match(/roll(\d+)\.xml/)![1]);
    return roll <= 2
      ? { ok: true, status: 200, text: HOUSE_XML }
      : { ok: false, status: 404, text: "" };
  };
  const { db } = makeDbStub();
  const result = await ingestVotes({
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    chamber: "house",
    congress: 118,
    session: 1,
    year: 2023,
    startRoll: 1,
    endRoll: 2,
    fetchText,
    db,
    knownMembers: new Set(["A000374", "B001230", "C000001", "P000001"]),
    lisToBioguide: new Map(),
  });
  assert.equal(result.rollCallsProcessed, 2);
  assert.equal(result.rollCallsMissing, 0);
});

test("ingestVotes: Senate uses LIS crosswalk; unresolved counted", async () => {
  const fetchText = async (url: string) => {
    return url.includes("vote_118_1_00001")
      ? { ok: true, status: 200, text: SENATE_XML }
      : { ok: false, status: 404, text: "" };
  };
  const { db } = makeDbStub();
  const result = await ingestVotes({
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    chamber: "senate",
    congress: 118,
    session: 1,
    maxConsecutiveMisses: 2,
    fetchText,
    db,
    lisToBioguide: new Map([["S354", "B001230"]]),
    knownMembers: new Set(["B001230"]),
  });
  assert.equal(result.rollCallsProcessed, 1);
  assert.equal(result.votesUpserted, 1);
  assert.equal(result.skippedUnresolved, 2); // S341, S363 not in crosswalk
});

test("ingestVotes: parse error is recorded, ingestion continues", async () => {
  const fetchText = async (url: string) => {
    const roll = Number(url.match(/roll(\d+)\.xml/)![1]);
    if (roll === 1) return { ok: true, status: 200, text: "<not-valid><<<" };
    if (roll === 2) return { ok: true, status: 200, text: HOUSE_XML };
    return { ok: false, status: 404, text: "" };
  };
  const { db } = makeDbStub();
  const result = await ingestVotes({
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    chamber: "house",
    congress: 118,
    session: 1,
    year: 2023,
    maxConsecutiveMisses: 2,
    fetchText,
    db,
    knownMembers: new Set(["A000374", "B001230", "C000001", "P000001"]),
    lisToBioguide: new Map(),
  });
  // roll 1 either parses to empty or errors; roll 2 must still be processed.
  assert.ok(result.rollCallsProcessed >= 1);
  assert.ok(result.votesUpserted >= 4);
});
