import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CongressClient,
  HttpError,
  RateLimitExceededError,
  MAX_PAGE_SIZE,
} from "./_client.ts";

// --- Test doubles ---------------------------------------------------------

/** Deterministic clock whose sleep advances time and records each wait. */
function makeClock() {
  let t = 1_000;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
    waits,
  };
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Stub fetch that returns queued responses and records requested URLs. */
function queueFetch(responses: Array<Response | (() => Response | never)>) {
  const urls: string[] = [];
  let i = 0;
  const fetchFn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    const next = responses[i++];
    if (next === undefined) throw new Error("fetch called more than expected");
    return typeof next === "function" ? next() : next;
  }) as unknown as typeof fetch;
  return { fetchFn, urls };
}

function clientWith(
  responses: Array<Response | (() => Response | never)>,
  overrides: Partial<ConstructorParameters<typeof CongressClient>[0]> = {},
) {
  const clock = makeClock();
  const { fetchFn, urls } = queueFetch(responses);
  const client = new CongressClient({
    apiKey: "TESTKEY",
    fetchFn,
    now: clock.now,
    sleep: clock.sleep,
    random: () => 0, // no jitter -> deterministic backoff
    ...overrides,
  });
  return { client, urls, clock };
}

function offsetOf(url: string): number {
  return Number(new URL(url).searchParams.get("offset"));
}

// --- Paging (the Phase 2 QA gate) ----------------------------------------

test("paginate walks every page and yields items in order", async () => {
  const { client, urls } = clientWith([
    json({ members: [{ id: 1 }, { id: 2 }], pagination: { count: 5 } }),
    json({ members: [{ id: 3 }, { id: 4 }], pagination: { count: 5 } }),
    json({ members: [{ id: 5 }], pagination: { count: 5 } }),
  ]);

  const ids: number[] = [];
  for await (const m of client.paginate<{ id: number }>("member", {
    pageSize: 2,
  })) {
    ids.push(m.id);
  }

  assert.deepEqual(ids, [1, 2, 3, 4, 5]);
  assert.equal(urls.length, 3, "one request per page");
  assert.deepEqual(urls.map(offsetOf), [0, 2, 4], "offset advances by page size");
});

test("paginate stops on a short final page when count is absent", async () => {
  const { client, urls } = clientWith([
    json({ bills: [{ n: 1 }, { n: 2 }] }), // full page, no count -> fetch again
    json({ bills: [{ n: 3 }] }), // short page -> stop
  ]);

  const got = await client.fetchAll<{ n: number }>("bill", { pageSize: 2 });
  assert.deepEqual(got.map((b) => b.n), [1, 2, 3]);
  assert.equal(urls.length, 2);
});

test("paginate stops at reported count even when the page is full", async () => {
  const { client, urls } = clientWith([
    json({ members: [{ id: 1 }, { id: 2 }], pagination: { count: 2 } }),
  ]);
  const got = await client.fetchAll<{ id: number }>("member", { pageSize: 2 });
  assert.deepEqual(got.map((m) => m.id), [1, 2]);
  assert.equal(urls.length, 1, "no extra request once count is satisfied");
});

test("paginate auto-detects the item array, ignoring pagination/request", async () => {
  const { client } = clientWith([
    json({
      request: { contentType: "json" },
      pagination: { count: 1 },
      committees: [{ code: "x" }],
    }),
  ]);
  const got = await client.fetchAll<{ code: string }>("committee");
  assert.deepEqual(got, [{ code: "x" }]);
});

test("paginate honours an explicit itemsKey", async () => {
  const { client } = clientWith([
    json({ amendments: [{ id: "a" }], somethingElse: [{ id: "ignore" }] }),
  ]);
  const got = await client.fetchAll<{ id: string }>("amendment", {
    itemsKey: "amendments",
  });
  assert.deepEqual(got, [{ id: "a" }]);
});

test("paginate respects maxItems", async () => {
  const { client, urls } = clientWith([
    json({ members: [{ id: 1 }, { id: 2 }, { id: 3 }], pagination: { count: 9 } }),
  ]);
  const got = await client.fetchAll<{ id: number }>("member", {
    pageSize: 3,
    maxItems: 2,
  });
  assert.deepEqual(got.map((m) => m.id), [1, 2]);
  assert.equal(urls.length, 1);
});

test("paginate clamps pageSize to the API maximum and sets paging params", async () => {
  const { client, urls } = clientWith([json({ members: [], pagination: { count: 0 } })]);
  await client.fetchAll("member", { pageSize: 9999 });
  const u = new URL(urls[0]);
  assert.equal(u.searchParams.get("limit"), String(MAX_PAGE_SIZE));
  assert.equal(u.searchParams.get("offset"), "0");
});

// --- Request building -----------------------------------------------------

test("get appends api_key and format=json and passes through params", async () => {
  const { client, urls } = clientWith([json({ ok: true })]);
  await client.get("member", { currentMember: "true", fromDateTime: "2024-01-01T00:00:00Z" });
  const u = new URL(urls[0]);
  assert.equal(u.searchParams.get("api_key"), "TESTKEY");
  assert.equal(u.searchParams.get("format"), "json");
  assert.equal(u.searchParams.get("currentMember"), "true");
  assert.equal(u.searchParams.get("fromDateTime"), "2024-01-01T00:00:00Z");
});

// --- Retries --------------------------------------------------------------

test("get retries on 500 then succeeds", async () => {
  const { client, urls, clock } = clientWith([
    json({ msg: "boom" }, 500),
    json({ ok: true }),
  ]);
  const res = await client.get<{ ok: boolean }>("member");
  assert.deepEqual(res, { ok: true });
  assert.equal(urls.length, 2);
  assert.equal(clock.waits.length, 1, "one backoff wait between attempts");
});

test("get honours Retry-After on 429", async () => {
  const { client, clock } = clientWith([
    json({}, 429, { "retry-after": "3" }),
    json({ ok: true }),
  ]);
  await client.get("member");
  assert.equal(clock.waits[0], 3000, "waited the Retry-After seconds");
});

test("get does not retry a 404 and throws HttpError", async () => {
  const { client, urls } = clientWith([json({ error: "nope" }, 404)]);
  await assert.rejects(() => client.get("member/BADID"), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal((err as HttpError).status, 404);
    return true;
  });
  assert.equal(urls.length, 1, "404 is not retried");
});

test("get retries network errors then gives up after maxRetries", async () => {
  const boom = () => {
    throw new Error("ECONNRESET");
  };
  const { client, urls } = clientWith([boom, boom, boom], { maxRetries: 2 });
  await assert.rejects(() => client.get("member"), /ECONNRESET/);
  assert.equal(urls.length, 3, "1 initial try + 2 retries");
});

test("backoff grows exponentially from backoffBaseMs", async () => {
  const { client, clock } = clientWith(
    [json({}, 503), json({}, 503), json({ ok: true })],
    { backoffBaseMs: 100 },
  );
  await client.get("member");
  // attempt 0 -> 100 * 2^0, attempt 1 -> 100 * 2^1 (random()=0 -> no jitter)
  assert.deepEqual(clock.waits, [100, 200]);
});

// --- Throttle + daily cap -------------------------------------------------

test("throttle enforces a minimum gap between requests", async () => {
  const { client, clock } = clientWith([json({ a: 1 }), json({ b: 2 })], {
    minIntervalMs: 250,
  });
  await client.get("member");
  await client.get("bill");
  // First request: no prior request, no wait. Second: full interval.
  assert.deepEqual(clock.waits, [250]);
});

test("daily cap throws once exhausted and resets after 24h", async () => {
  const { client, clock } = clientWith(
    [json({ a: 1 }), json({ b: 2 }), json({ c: 3 })],
    { maxRequestsPerDay: 2 },
  );
  await client.get("member");
  await client.get("bill");
  assert.equal(client.requestsUsedToday, 2);
  await assert.rejects(() => client.get("nope"), RateLimitExceededError);

  clock.advance(24 * 60 * 60 * 1000 + 1); // roll past the window
  assert.equal(client.requestsUsedToday, 0);
  const res = await client.get<{ c: number }>("again");
  assert.deepEqual(res, { c: 3 });
});

test("constructor rejects a missing api key", () => {
  assert.throws(() => new CongressClient({ apiKey: "" }), /requires an apiKey/);
});
