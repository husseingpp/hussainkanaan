/**
 * Demo dataset for the GitHub Pages preview build.
 *
 * Enabled by NEXT_PUBLIC_DEMO=true (set in the Pages build). When on, the query
 * layer returns this fictional data instead of querying Supabase, so the full UI
 * is visible with no backend configured.
 *
 * IMPORTANT (hard rule 1 — never fabricate claims about real people): every
 * member here is OBVIOUSLY fictional ("Dana Demo", "Sam Sample", …). No real
 * member of Congress appears, so the made-up promises/votes/verdicts implicate
 * nobody. A visible "Demo data" banner reinforces this in the UI.
 */
import type {
  Member,
  Term,
  Bill,
  Sponsorship,
  Vote,
  AlignmentScore,
  PromiseRow,
  Wing,
  Party,
  Chamber,
} from "./database.types.ts";
import type {
  MemberFilters,
  MemberListResult,
  BillFilters,
  BillListResult,
  SponsorshipWithMember,
  SponsorshipWithBill,
  VoteWithBill,
  MemberOption,
  MemberStats,
  WingBrowse,
  WingColumn,
} from "./queries.ts";

export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO === "true";
}

const NOW = "2026-01-05T00:00:00Z";
const PAGE = 100;

function mk(
  id: string,
  first: string,
  last: string,
  party: Party,
  state: string,
  chamber: Chamber,
  wing: Wing,
): Member {
  return {
    bioguide_id: id,
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`,
    party,
    state,
    current_chamber: chamber,
    image_url: null,
    congress_url: null,
    current_wing: wing,
    lis_id: null,
    source_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

// 9 fictional members — three per wing, mixed party/state/chamber.
const MEMBERS: Member[] = [
  mk("DMO0001", "Dana", "Demo", "D", "CA", "senate", "left"),
  mk("DMO0002", "Robin", "Reyes", "D", "NY", "house", "left"),
  mk("DMO0003", "Sam", "Sample", "I", "VT", "senate", "left"),
  mk("DMO0004", "Pat", "Placeholder", "D", "AZ", "house", "center"),
  mk("DMO0005", "Casey", "Carter", "R", "ME", "senate", "center"),
  mk("DMO0006", "Jordan", "Jones", "R", "OH", "house", "center"),
  mk("DMO0007", "Taylor", "Test", "R", "TX", "senate", "right"),
  mk("DMO0008", "Morgan", "Mock", "R", "FL", "house", "right"),
  mk("DMO0009", "Alex", "Avatar", "L", "KY", "house", "right"),
];

const DIM1: Record<string, number> = {
  DMO0001: -0.62,
  DMO0002: -0.48,
  DMO0003: -0.55,
  DMO0004: -0.08,
  DMO0005: 0.06,
  DMO0006: 0.14,
  DMO0007: 0.58,
  DMO0008: 0.71,
  DMO0009: 0.49,
};

const ALIGNMENT: AlignmentScore[] = MEMBERS.map((m) => ({
  id: `al-${m.bioguide_id}`,
  bioguide_id: m.bioguide_id,
  congress: 119,
  metric: "dwnominate",
  dimension1: DIM1[m.bioguide_id] ?? 0,
  dimension2: 0.1,
  wing: m.current_wing as Wing,
  source_url: "https://voteview.com",
  methodology_url: "/methodology",
  computed_at: NOW,
}));

const TERMS: Term[] = MEMBERS.flatMap((m, i) => {
  const base: Term = {
    id: `tm-${m.bioguide_id}-119`,
    bioguide_id: m.bioguide_id,
    congress: 119,
    chamber: m.current_chamber as Chamber,
    state: m.state,
    district: m.current_chamber === "house" ? (i % 12) + 1 : null,
    party: m.party,
    start_year: 2025,
    end_year: 2027,
    created_at: NOW,
  };
  const prior: Term = { ...base, id: `tm-${m.bioguide_id}-118`, congress: 118, start_year: 2023, end_year: 2025 };
  return i % 2 === 0 ? [base, prior] : [base];
});

const BILLS: Bill[] = [
  bill("119-hr-100", 119, "hr", 100, "Demo Transparency in Government Act", true, "Government Operations", "2025-09-12"),
  bill("119-hr-200", 119, "hr", 200, "Sample Infrastructure Investment Act", false, "Transportation", "2025-10-01"),
  bill("119-s-50", 119, "s", 50, "Placeholder Clean Water Act", false, "Environment", "2025-08-20"),
  bill("119-hr-300", 119, "hr", 300, "Mock Education Funding Act", false, "Education", "2025-07-15"),
  bill("119-s-75", 119, "s", 75, "Test Veterans Support Act", true, "Armed Forces and National Security", "2025-11-03"),
  bill("118-hr-400", 118, "hr", 400, "Example Small Business Relief Act", false, "Commerce", "2024-05-09"),
];

function bill(
  id: string,
  congress: number,
  type: string,
  number: number,
  title: string,
  becameLaw: boolean,
  policy: string,
  latest: string,
): Bill {
  return {
    id,
    congress,
    bill_type: type,
    number,
    title,
    short_title: null,
    introduced_date: "2025-01-20",
    latest_action_date: latest,
    latest_action: becameLaw ? "Became Public Law (demo)" : "Referred to committee (demo)",
    became_law: becameLaw,
    policy_area: policy,
    congress_url: null,
    source_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

// Sponsorships: one sponsor + a few cosponsors per bill.
const SPON: Sponsorship[] = [
  spon("DMO0002", "119-hr-100", true, "2025-01-20"),
  spon("DMO0001", "119-hr-100", false, "2025-01-22"),
  spon("DMO0004", "119-hr-100", false, "2025-01-23"),
  spon("DMO0006", "119-hr-200", true, "2025-02-02"),
  spon("DMO0008", "119-hr-200", false, "2025-02-05"),
  spon("DMO0003", "119-s-50", true, "2025-03-10"),
  spon("DMO0001", "119-s-50", false, "2025-03-11"),
  spon("DMO0002", "119-hr-300", true, "2025-04-01"),
  spon("DMO0007", "119-s-75", true, "2025-05-14"),
  spon("DMO0005", "119-s-75", false, "2025-05-16"),
  spon("DMO0009", "118-hr-400", true, "2024-02-01"),
  spon("DMO0008", "118-hr-400", false, "2024-02-03"),
];

function spon(bio: string, billId: string, isSponsor: boolean, date: string): Sponsorship {
  return {
    id: `sp-${bio}-${billId}`,
    bioguide_id: bio,
    bill_id: billId,
    is_sponsor: isSponsor,
    sponsored_date: date,
    created_at: NOW,
  };
}

const VOTES: Vote[] = [
  vote("DMO0001", 1, "On Passage: Demo Transparency in Government Act", "119-hr-100", "yea", "2025-09-10"),
  vote("DMO0001", 2, "On the Amendment to S. 50", "119-s-50", "yea", "2025-08-19"),
  vote("DMO0001", 3, "On Passage: Test Veterans Support Act", "119-s-75", "nay", "2025-11-02"),
  vote("DMO0002", 1, "On Passage: Demo Transparency in Government Act", "119-hr-100", "yea", "2025-09-10"),
  vote("DMO0002", 4, "On Passage: Mock Education Funding Act", "119-hr-300", "yea", "2025-07-14"),
  vote("DMO0007", 1, "On Passage: Demo Transparency in Government Act", "119-hr-100", "nay", "2025-09-10"),
  vote("DMO0007", 3, "On Passage: Test Veterans Support Act", "119-s-75", "yea", "2025-11-02"),
  vote("DMO0007", 5, "On the Motion to Proceed", null, "present", "2025-10-22"),
  vote("DMO0005", 3, "On Passage: Test Veterans Support Act", "119-s-75", "yea", "2025-11-02"),
];

function vote(
  bio: string,
  roll: number,
  question: string,
  billId: string | null,
  position: Vote["position"],
  date: string,
): Vote {
  const chamber: Chamber = MEMBERS.find((m) => m.bioguide_id === bio)?.current_chamber ?? "house";
  return {
    id: `vt-${bio}-${roll}`,
    bioguide_id: bio,
    congress: 119,
    chamber,
    session: 1,
    roll_call: roll,
    vote_date: date,
    question,
    description: null,
    bill_id: billId,
    position,
    source_url: "https://example.com/demo/roll-call",
    created_at: NOW,
    updated_at: NOW,
  };
}

const PROMISES: PromiseRow[] = [
  promise("DMO0001", "Introduce a bill expanding government transparency in the first 100 days.", "Government", "kept", "Sponsored the Demo Transparency in Government Act, which became law.", "2024-10-01"),
  promise("DMO0001", "Hold monthly in-person town halls in every county.", "Accountability", "partial", "Held town halls in most, but not all, counties this session.", "2024-10-05"),
  promise("DMO0002", "Secure full federal funding for the district's school modernization.", "Education", "unverified", null, "2024-09-15"),
  promise("DMO0007", "Vote against any increase to the federal debt ceiling.", "Fiscal", "broken", "Voted in favor of a debt-ceiling increase in the demo record.", "2024-10-10"),
  promise("DMO0005", "Work across the aisle on a bipartisan veterans package.", "Veterans", "kept", "Cosponsored the Test Veterans Support Act, enacted with bipartisan support.", "2024-08-30"),
];

function promise(
  bio: string,
  text: string,
  topic: string,
  status: PromiseRow["status"],
  rationale: string | null,
  made: string,
): PromiseRow {
  const resolved = status !== "unverified";
  return {
    id: `pr-${bio}-${text.slice(0, 8)}`,
    bioguide_id: bio,
    text,
    topic,
    made_date: made,
    made_context: "Campaign statement (demo)",
    source_url: "https://example.com/demo/promise-source",
    status,
    status_rationale: rationale,
    status_source_url: resolved ? "https://example.com/demo/evidence" : null,
    reviewed_by: resolved ? "demo-reviewer" : null,
    reviewed_at: resolved ? NOW : null,
    created_at: NOW,
    updated_at: NOW,
  };
}

// ---------------------------------------------------------------------------
// Accessors — mirror the shapes returned by lib/queries.ts
// ---------------------------------------------------------------------------

function byId(bio: string) {
  return MEMBERS.find((m) => m.bioguide_id === bio) ?? null;
}

function pickMember(m: Member) {
  return {
    bioguide_id: m.bioguide_id,
    full_name: m.full_name,
    party: m.party,
    state: m.state,
    current_chamber: m.current_chamber,
    image_url: m.image_url,
  };
}

export function demoGetMembers(filters: MemberFilters): MemberListResult {
  let rows = [...MEMBERS];
  if (filters.chamber === "house" || filters.chamber === "senate") {
    rows = rows.filter((m) => m.current_chamber === filters.chamber);
  }
  if (filters.party) rows = rows.filter((m) => m.party === filters.party);
  if (filters.state && /^[A-Z]{2}$/.test(filters.state)) {
    rows = rows.filter((m) => m.state === filters.state);
  }
  if (filters.wing === "left" || filters.wing === "center" || filters.wing === "right") {
    rows = rows.filter((m) => m.current_wing === filters.wing);
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) rows = rows.filter((m) => m.full_name.toLowerCase().includes(q));
  rows.sort((a, b) => a.last_name.localeCompare(b.last_name));

  const page = Math.max(0, Number(filters.page ?? 0));
  const from = page * PAGE;
  return { members: rows.slice(from, from + PAGE), total: rows.length, page };
}

export function demoGetMember(bio: string): Member | null {
  return byId(bio);
}

export function demoGetMemberTerms(bio: string): Term[] {
  return TERMS.filter((t) => t.bioguide_id === bio).sort((a, b) => b.congress - a.congress);
}

export function demoGetBills(filters: BillFilters): BillListResult {
  let rows = [...BILLS];
  const congress = Number(filters.congress);
  if (Number.isFinite(congress) && congress > 0) rows = rows.filter((b) => b.congress === congress);
  if (filters.status === "law") rows = rows.filter((b) => b.became_law);
  const q = filters.q?.trim().toLowerCase();
  if (q) rows = rows.filter((b) => (b.title ?? "").toLowerCase().includes(q));
  rows.sort((a, b) => (b.latest_action_date ?? "").localeCompare(a.latest_action_date ?? ""));

  const page = Math.max(0, Number(filters.page ?? 0));
  const from = page * PAGE;
  return { bills: rows.slice(from, from + PAGE), total: rows.length, page };
}

export function demoGetBill(id: string): Bill | null {
  return BILLS.find((b) => b.id === id) ?? null;
}

export function demoGetBillSponsorships(billId: string): SponsorshipWithMember[] {
  return SPON.filter((s) => s.bill_id === billId)
    .sort((a, b) => Number(b.is_sponsor) - Number(a.is_sponsor))
    .map((s) => {
      const m = byId(s.bioguide_id);
      return { ...s, members: m ? pickMember(m) : null };
    });
}

export function demoGetMemberSponsorships(bio: string, limit = 25): SponsorshipWithBill[] {
  return SPON.filter((s) => s.bioguide_id === bio)
    .sort((a, b) => Number(b.is_sponsor) - Number(a.is_sponsor))
    .slice(0, limit)
    .map((s) => {
      const b = demoGetBill(s.bill_id);
      return {
        ...s,
        bills: b
          ? {
              id: b.id,
              congress: b.congress,
              bill_type: b.bill_type,
              number: b.number,
              title: b.title,
              became_law: b.became_law,
              latest_action_date: b.latest_action_date,
            }
          : null,
      };
    });
}

export function demoGetMemberVotes(bio: string, limit = 25): VoteWithBill[] {
  return VOTES.filter((v) => v.bioguide_id === bio)
    .sort((a, b) => (b.vote_date ?? "").localeCompare(a.vote_date ?? ""))
    .slice(0, limit)
    .map((v) => {
      const b = v.bill_id ? demoGetBill(v.bill_id) : null;
      return {
        ...v,
        bills: b ? { id: b.id, bill_type: b.bill_type, number: b.number, title: b.title } : null,
      };
    });
}

export function demoGetMemberAlignment(bio: string): AlignmentScore | null {
  return ALIGNMENT.find((a) => a.bioguide_id === bio) ?? null;
}

export function demoGetMemberPromises(bio: string): PromiseRow[] {
  return PROMISES.filter((p) => p.bioguide_id === bio);
}

export function demoGetMembersByWing(
  filters: { chamber?: string; state?: string },
  perColumn = 50,
): WingBrowse {
  function column(wing: Wing): WingColumn {
    let rows = MEMBERS.filter((m) => m.current_wing === wing);
    if (filters.chamber === "house" || filters.chamber === "senate") {
      rows = rows.filter((m) => m.current_chamber === filters.chamber);
    }
    if (filters.state && /^[A-Z]{2}$/.test(filters.state)) {
      rows = rows.filter((m) => m.state === filters.state);
    }
    rows.sort((a, b) => a.last_name.localeCompare(b.last_name));
    return { members: rows.slice(0, perColumn), total: rows.length };
  }
  return { left: column("left"), center: column("center"), right: column("right") };
}

export function demoGetMemberStats(bio: string): MemberStats {
  const spons = SPON.filter((s) => s.bioguide_id === bio);
  return {
    sponsored: spons.filter((s) => s.is_sponsor).length,
    cosponsored: spons.filter((s) => !s.is_sponsor).length,
    billsBecameLaw: 0,
    votes: VOTES.filter((v) => v.bioguide_id === bio).length,
  };
}

export function demoGetMemberOptions(): MemberOption[] {
  return [...MEMBERS]
    .sort((a, b) => a.last_name.localeCompare(b.last_name))
    .map((m) => ({
      bioguide_id: m.bioguide_id,
      full_name: m.full_name,
      party: m.party,
      state: m.state,
    }));
}

export function demoGetAllMemberIds(): string[] {
  return MEMBERS.map((m) => m.bioguide_id);
}

export function demoGetAllBillIds(): string[] {
  return BILLS.map((b) => b.id);
}
