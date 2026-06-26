import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeBillId,
  detectBecameLaw,
  transformBill,
  transformSponsors,
  transformCosponsor,
  billDetailPath,
  ingestBills,
  type ApiBillListItem,
  type ApiBillDetail,
  type BillRow,
} from "./bills.ts";
import { CongressClient } from "./_client.ts";

// ---------------------------------------------------------------------------
// makeBillId
// ---------------------------------------------------------------------------

test("makeBillId lowercases type and joins parts", () => {
  assert.equal(makeBillId(117, "HR", "3076"), "117-hr-3076");
  assert.equal(makeBillId(118, "S", 1), "118-s-1");
  assert.equal(makeBillId(119, "HJRES", "20"), "119-hjres-20");
});

// ---------------------------------------------------------------------------
// detectBecameLaw
// ---------------------------------------------------------------------------

test("detectBecameLaw: true when laws array is non-empty", () => {
  const item: ApiBillDetail = {
    congress: 117,
    type: "HR",
    number: "3076",
    laws: [{ number: "117-108", type: "Public Law" }],
  };
  assert.equal(detectBecameLaw(item), true);
});

test("detectBecameLaw: true from latest action text", () => {
  assert.equal(
    detectBecameLaw({
      congress: 117,
      type: "HR",
      number: "3076",
      latestAction: { text: "Became Public Law No: 117-108." },
    }),
    true,
  );
  assert.equal(
    detectBecameLaw({
      congress: 100,
      type: "HR",
      number: "1",
      latestAction: { text: "Became Private Law No: 100-1." },
    }),
    true,
  );
});

test("detectBecameLaw: false otherwise", () => {
  assert.equal(
    detectBecameLaw({
      congress: 118,
      type: "HR",
      number: "9",
      latestAction: { text: "Referred to the Committee on Ways and Means." },
    }),
    false,
  );
  assert.equal(detectBecameLaw({ congress: 118, type: "S", number: "1" }), false);
});

test("detectBecameLaw: empty laws array is not became_law", () => {
  assert.equal(
    detectBecameLaw({ congress: 118, type: "HR", number: "9", laws: [] }),
    false,
  );
});

// ---------------------------------------------------------------------------
// transformBill
// ---------------------------------------------------------------------------

const listItem: ApiBillListItem = {
  congress: 117,
  type: "HR",
  number: "3076",
  title: "Postal Service Reform Act of 2022",
  latestAction: { actionDate: "2022-04-06", text: "Became Public Law No: 117-108." },
  policyArea: { name: "Government Operations and Politics" },
  updateDate: "2022-09-29",
  updateDateIncludingText: "2022-09-29T03:27:05Z",
  url: "https://api.congress.gov/v3/bill/117/hr/3076?format=json",
};

test("transformBill: maps a list item correctly", () => {
  const row: BillRow = transformBill(listItem);
  assert.equal(row.id, "117-hr-3076");
  assert.equal(row.congress, 117);
  assert.equal(row.bill_type, "hr");
  assert.equal(row.number, 3076);
  assert.equal(row.title, "Postal Service Reform Act of 2022");
  assert.equal(row.short_title, null);
  assert.equal(row.latest_action_date, "2022-04-06");
  assert.equal(row.became_law, true);
  assert.equal(row.policy_area, "Government Operations and Politics");
  assert.equal(row.congress_url, listItem.url);
  assert.equal(row.source_updated_at, "2022-09-29T03:27:05.000Z");
  assert.equal(row.introduced_date, null); // not present on list items
});

test("transformBill: detail enriches via spread", () => {
  const detail: ApiBillDetail = {
    ...listItem,
    introducedDate: "2021-05-11",
  };
  const row = transformBill({ ...listItem, ...detail });
  assert.equal(row.introduced_date, "2021-05-11");
});

test("transformBill: handles missing/invalid number gracefully", () => {
  const row = transformBill({ congress: 118, type: "S", number: "abc" });
  assert.equal(row.number, 0);
  assert.equal(row.id, "118-s-abc");
});

test("transformBill: source_updated_at falls back to updateDate", () => {
  const row = transformBill({
    congress: 118,
    type: "HR",
    number: "1",
    updateDate: "2023-01-09",
  });
  assert.ok(row.source_updated_at?.startsWith("2023-01-09"));
});

// ---------------------------------------------------------------------------
// transformSponsors / transformCosponsor
// ---------------------------------------------------------------------------

test("transformSponsors: builds primary sponsor rows with introduced date", () => {
  const detail: ApiBillDetail = {
    congress: 117,
    type: "HR",
    number: "3076",
    introducedDate: "2021-05-11",
    sponsors: [{ bioguideId: "M001188", fullName: "Rep. Maloney" }],
  };
  const rows = transformSponsors("117-hr-3076", detail);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    bill_id: "117-hr-3076",
    bioguide_id: "M001188",
    is_sponsor: true,
    sponsored_date: "2021-05-11",
  });
});

test("transformSponsors: skips sponsors without bioguideId", () => {
  const rows = transformSponsors("117-hr-3076", {
    congress: 117,
    type: "HR",
    number: "3076",
    sponsors: [{ fullName: "No id" }, { bioguideId: "X000001" }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bioguide_id, "X000001");
});

test("transformSponsors: no sponsors -> empty", () => {
  assert.deepEqual(
    transformSponsors("1-s-1", { congress: 1, type: "S", number: "1" }),
    [],
  );
});

test("transformCosponsor: builds a cosponsor row (is_sponsor false)", () => {
  const row = transformCosponsor("117-hr-3076", {
    bioguideId: "C000001",
    sponsorshipDate: "2021-06-01",
  });
  assert.deepEqual(row, {
    bill_id: "117-hr-3076",
    bioguide_id: "C000001",
    is_sponsor: false,
    sponsored_date: "2021-06-01",
  });
});

test("transformCosponsor: null when no bioguideId", () => {
  assert.equal(transformCosponsor("1-s-1", { fullName: "x" }), null);
});

// ---------------------------------------------------------------------------
// billDetailPath
// ---------------------------------------------------------------------------

test("billDetailPath builds the v3 detail path", () => {
  assert.equal(billDetailPath(117, "HR", "3076"), "bill/117/hr/3076");
});

// ---------------------------------------------------------------------------
// ingestBills — integration with stubbed client + DB
// ---------------------------------------------------------------------------

/**
 * Stub fetch that serves a bill list and per-bill detail responses keyed by
 * the request path.
 */
function makeBillFetch(opts: {
  bills: ApiBillListItem[];
  details?: Record<string, ApiBillDetail>;
}): typeof fetch {
  return (async (rawUrl: string) => {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/v3\//, "").replace(/^\//, "");

    // Detail: bill/{congress}/{type}/{number}
    const detailMatch = path.match(/^bill\/(\d+)\/([a-z]+)\/(\w+)$/);
    if (detailMatch) {
      const id = `${detailMatch[1]}-${detailMatch[2]}-${detailMatch[3]}`;
      const detail = opts.details?.[id] ?? {
        congress: Number(detailMatch[1]),
        type: detailMatch[2],
        number: detailMatch[3],
      };
      return new Response(JSON.stringify({ bill: detail }), { status: 200 });
    }

    // List: bill or bill/{congress}
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 250);
    const slice = opts.bills.slice(offset, offset + limit);
    return new Response(
      JSON.stringify({ bills: slice, pagination: { count: opts.bills.length } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

function makeClient(fetchFn: typeof fetch): CongressClient {
  let i = 0;
  return new CongressClient({
    apiKey: "TEST",
    fetchFn,
    now: () => ++i * 1000,
    sleep: async () => {},
    random: () => 0,
  });
}

/** Records bills upserted and sponsorships upserted. */
function makeDbStub(opts: { memberIds?: string[]; sponsorshipError?: string } = {}) {
  const billUpserts: BillRow[][] = [];
  const sponsorshipUpserts: object[][] = [];
  const members = (opts.memberIds ?? []).map((id) => ({ bioguide_id: id }));

  function builder(table: string): any {
    return {
      // members id load
      select() {
        return {
          range(_from: number, _to: number) {
            // Return all members on the first range, empty after.
            const data = _from === 0 ? members : [];
            return Promise.resolve({ data, error: null });
          },
        };
      },
      upsert(rows: any[]) {
        if (table === "bills") billUpserts.push(rows);
        if (table === "sponsorships") sponsorshipUpserts.push(rows);
        const error =
          table === "sponsorships" && opts.sponsorshipError
            ? { message: opts.sponsorshipError }
            : null;
        return {
          then: (res: any) => Promise.resolve({ error }).then(res),
        };
      },
    };
  }

  return {
    db: { from: (t: string) => builder(t) } as any,
    billUpserts,
    sponsorshipUpserts,
  };
}

const twoBills: ApiBillListItem[] = [
  { congress: 117, type: "HR", number: "3076", title: "Postal Reform", updateDate: "2022-09-29" },
  { congress: 117, type: "S", number: "1", title: "For the People Act", updateDate: "2021-03-17" },
];

const details: Record<string, ApiBillDetail> = {
  "117-hr-3076": {
    congress: 117,
    type: "HR",
    number: "3076",
    introducedDate: "2021-05-11",
    sponsors: [{ bioguideId: "M001188" }],
    laws: [{ number: "117-108", type: "Public Law" }],
  },
  "117-s-1": {
    congress: 117,
    type: "S",
    number: "1",
    introducedDate: "2021-03-17",
    sponsors: [{ bioguideId: "M000934" }],
  },
};

test("ingestBills: upserts bills and sponsorships from detail", async () => {
  const client = makeClient(makeBillFetch({ bills: twoBills, details }));
  const { db, billUpserts, sponsorshipUpserts } = makeDbStub({
    memberIds: ["M001188", "M000934"],
  });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });

  assert.equal(result.billsUpserted, 2);
  assert.equal(result.sponsorshipsUpserted, 2);
  assert.equal(result.skippedSponsorships, 0);
  assert.equal(result.errors.length, 0);

  // became_law enrichment came through the detail/laws path
  const allBills = billUpserts.flat();
  const postal = allBills.find((b) => b.id === "117-hr-3076");
  assert.equal(postal?.became_law, true);
  assert.equal(postal?.introduced_date, "2021-05-11");
  assert.equal(sponsorshipUpserts.flat().length, 2);
});

test("ingestBills: filters sponsorships for unknown members", async () => {
  const client = makeClient(makeBillFetch({ bills: twoBills, details }));
  // Only one of the two sponsors is a known member.
  const { db, sponsorshipUpserts } = makeDbStub({ memberIds: ["M001188"] });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });

  assert.equal(result.billsUpserted, 2);
  assert.equal(result.sponsorshipsUpserted, 1);
  assert.equal(result.skippedSponsorships, 1);
  assert.deepEqual(
    sponsorshipUpserts.flat().map((s: any) => s.bioguide_id),
    ["M001188"],
  );
});

test("ingestBills: withDetail=false upserts bills only, no detail requests", async () => {
  let detailCalls = 0;
  const fetchFn = (async (rawUrl: string) => {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/v3\//, "");
    if (/^bill\/\d+\/[a-z]+\/\w+$/.test(path)) detailCalls++;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const slice = twoBills.slice(offset, offset + 250);
    return new Response(
      JSON.stringify({ bills: slice, pagination: { count: twoBills.length } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const client = makeClient(fetchFn);
  const { db } = makeDbStub({ memberIds: [] });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    withDetail: false,
    client,
    db,
  });

  assert.equal(result.billsUpserted, 2);
  assert.equal(result.sponsorshipsUpserted, 0);
  assert.equal(detailCalls, 0, "no detail requests when withDetail is false");
});

test("ingestBills: detail fetch error is recorded but bill still upserted", async () => {
  const fetchFn = (async (rawUrl: string) => {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/v3\//, "");
    if (/^bill\/\d+\/[a-z]+\/\w+$/.test(path)) {
      return new Response("server error", { status: 500 });
    }
    const slice = twoBills.slice(0, 250);
    return new Response(
      JSON.stringify({ bills: slice, pagination: { count: twoBills.length } }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  // maxRetries 0 so the 500 fails fast.
  let i = 0;
  const client = new CongressClient({
    apiKey: "T",
    fetchFn,
    now: () => ++i * 1000,
    sleep: async () => {},
    random: () => 0,
    maxRetries: 0,
  });
  const { db } = makeDbStub({ memberIds: ["M001188"] });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });

  assert.equal(result.billsUpserted, 2, "bills still upserted from list data");
  assert.equal(result.sponsorshipsUpserted, 0);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((e) => e.error.includes("detail")));
});

test("ingestBills: de-dupes a member appearing twice for the same bill", async () => {
  const dupDetails: Record<string, ApiBillDetail> = {
    "117-hr-3076": {
      congress: 117,
      type: "HR",
      number: "3076",
      introducedDate: "2021-05-11",
      // Same member listed twice (defensive against API quirks).
      sponsors: [{ bioguideId: "M001188" }, { bioguideId: "M001188" }],
    },
  };
  const client = makeClient(
    makeBillFetch({ bills: [twoBills[0]], details: dupDetails }),
  );
  const { db, sponsorshipUpserts } = makeDbStub({ memberIds: ["M001188"] });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });

  assert.equal(result.sponsorshipsUpserted, 1, "duplicate collapsed to one row");
  assert.equal(sponsorshipUpserts.flat().length, 1);
});

test("ingestBills: sponsorship upsert error is recorded per bill", async () => {
  const client = makeClient(makeBillFetch({ bills: [twoBills[0]], details }));
  const { db } = makeDbStub({
    memberIds: ["M001188"],
    sponsorshipError: "fk violation",
  });

  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });

  assert.equal(result.billsUpserted, 1);
  assert.equal(result.sponsorshipsUpserted, 0);
  assert.ok(result.errors.some((e) => e.error.includes("sponsorship upsert")));
});

test("ingestBills: empty bill list -> zero counts", async () => {
  const client = makeClient(makeBillFetch({ bills: [] }));
  const { db } = makeDbStub({ memberIds: [] });
  const result = await ingestBills({
    apiKey: "T",
    supabaseUrl: "u",
    supabaseServiceKey: "k",
    congress: 117,
    client,
    db,
  });
  assert.equal(result.billsUpserted, 0);
  assert.equal(result.sponsorshipsUpserted, 0);
  assert.equal(result.errors.length, 0);
});
