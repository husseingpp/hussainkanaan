# CongressTracker

## What this is

A non-partisan accountability website covering every member of the US Congress.
For each member it shows: who they are, what they **promised** before being
elected, and what they **actually did** in office (votes, sponsored bills,
bills passed). The browse experience is split into **Left / Center / Right**
columns in the style of Ground News, so the same member or issue can be viewed
through each lens.

**The product only has value if people trust it. Every factual claim about a
real person must be traceable to a source. This is non-negotiable and is
enforced by the schema.**

## Stack

- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Row Level Security)
- Vercel (hosting + cron)
- Data: `api.congress.gov` (free key from data.gov) + House Clerk / Senate roll-call XML

## Hard rules (do not violate)

1. **Never auto-generate factual claims about real people.** Promises and their
   kept / broken / partial status come ONLY from seeded or human-reviewed data
   that carries a `source_url`. An LLM must never assert "X broke a promise."
2. **Every `promise` row and every `vote` row must carry a `source_url`.** No
   source, no display.
3. **Wing classification (left/center/right) uses an external, sourced ideology
   metric** (e.g. DW-NOMINATE), shown with a link to `/methodology`. Do not
   invent a partisan score.
4. **Congress.gov does NOT expose clean member-level roll-call votes.** Vote
   positions come from a SEPARATE ingestion module that parses House Clerk XML
   (`clerk.house.gov/evs/{year}/roll{n}.xml`) and Senate roll-call XML.
5. **Defamation is the top risk.** When a status would mark a named person as
   "broken", it requires a linked source AND a reviewer. Default to
   `unverified`, never guess.
6. Respect the Congress.gov rate limit (~5,000 requests/day per key). Page
   incrementally, cache, and sync by `updated_at` rather than full refetches.

## Build order (one module per session, QA gate between phases)

1. **Schema** — apply `supabase/migrations/0001_init.sql`, confirm RLS. ✅ scaffolded
2. **API client** — `ingest/_client.ts`: rate-limited, retrying, paging
   Congress.gov client. Unit-test paging before moving on. ✅ done
3. **Members ingestion** — `ingest/members.ts` → upsert `members` + `terms`. ✅ done
4. **Read-only UI** — member list (`/`) + profile (`/member/[bioguideId]`)
   wired to Supabase. No promises yet. ✅ done
5. **Bills ingestion** — `ingest/bills.ts` → `bills` + `sponsorships`; bill
   pages. ✅ done
6. **Votes ingestion** — `ingest/votes.ts` (House/Senate XML). This is the
   messiest module; isolate it and test parsing hard. ✅ done
7. **Wings + scores** — classification + `ingest/scores.ts` → `alignment_scores`. ✅ done
8. **Promises** — admin review tool (`/admin`) + seed data; promise/record
   split view on profiles. ✅ done
9. **Polish** — three-wing UI, `/compare`, `/methodology`, accessibility, launch. ✅ done

Do not start a phase until the previous phase's QA gate passes.

## Workflow conventions

- **Plan Mode before writing any code.** Propose the plan, get a check, then build.
- One feature/module per session.
- This file is the single source of truth. If a decision changes, update it here.
- Keep ingestion idempotent (upserts on stable keys), so jobs can re-run safely.
- All DB writes go through the service-role key in ingestion jobs or the
  authenticated reviewer role for `promises`. The public anon key is read-only.

## Data model summary

`members` (bioguide_id PK) · `terms` · `bills` (id = `{congress}-{type}-{number}`)
· `sponsorships` · `votes` · `promises` (sourced, reviewed) · `alignment_scores`
(computed). Full DDL in `supabase/migrations/0001_init.sql`.

## Environment

See `.env.example`. Required:
`CONGRESS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

## Tone / design

Credible, neutral, civic. The interface must read as a reference tool, not an
opinion site. Wing columns are descriptive, never pejorative. Always expose the
"why" behind a classification or status and link the source.

---

## Implementation notes (kept in sync as phases land)

### Phase 1 — Schema (scaffolded)

- `supabase/migrations/0001_init.sql` defines all seven tables, enum types,
  `updated_at` triggers, and RLS.
- **RLS posture:** every table is read-only to `anon` + `authenticated`
  (public site). `promises` additionally allows `INSERT`/`UPDATE` for
  `authenticated` users (the admin review tool — to be tightened to a reviewer
  role later). Ingestion writes use the `service_role` key, which bypasses RLS.
- **Schema-enforced hard rules:**
  - `votes.source_url` and `promises.source_url` are `NOT NULL` + non-empty
    `CHECK` (rule 2: no source, no display).
  - `promises.status` defaults to `unverified`; any non-`unverified` status
    requires both `reviewed_by` and a non-empty `status_source_url` (rules 1 &
    5: a resolved status needs a reviewer and a source).
  - `alignment_scores.source_url` is mandatory and carries `methodology_url`
    (rule 3).
- TypeScript mirror of the schema lives in `lib/database.types.ts`; Supabase
  clients in `lib/supabase.ts` (`createPublicClient` = anon/read-only,
  `createServiceClient` = server-only service role).
- **QA gate (run before Phase 2):** apply the migration to a Supabase project,
  then confirm with the anon key that `SELECT` works on every table but
  `INSERT`/`UPDATE`/`DELETE` are rejected, and that a `promises` row cannot be
  inserted without `source_url` or set to `broken` without a reviewer +
  `status_source_url`.

### Phase 2 — Congress.gov API client (done)

- `ingest/_client.ts` exposes `CongressClient` with `get()`, `paginate()`
  (async generator), and `fetchAll()`.
- **Rate limiting:** a soft daily cap (`maxRequestsPerDay`, default 5,000)
  throws `RateLimitExceededError` when exhausted and resets on a rolling 24h
  window; `minIntervalMs` smooths bursts. `requestsUsedToday` is observable.
- **Retries:** transient failures (408/425/429/5xx and network errors) retry
  with exponential backoff + jitter, capped at `backoffMaxMs`, honouring
  `Retry-After` on 429. Non-retryable statuses (e.g. 404) throw `HttpError`
  immediately. The `api_key` is redacted from error messages.
- **Paging:** offset/limit walk, auto-detecting the response array key (or via
  `itemsKey`), stopping at `pagination.count`, a short page, or `maxItems`.
  `pageSize` is clamped to the API max of 250.
- **Testability:** `fetchFn`, `now`, `sleep`, and `random` are injectable, so
  the whole suite runs with no network and deterministic timing.
- **QA gate (passed):** `npm test` — 16 unit tests covering paging order,
  termination conditions, key detection, retries/backoff, throttle, and the
  daily cap. `npm run typecheck` is clean.
- Next: Phase 5 adds bills ingestion and bill pages.

### Phase 4 — Read-only UI (done)

Files added:
- `lib/queries.ts` — `getMembers(filters)`, `getMember(id)`, `getMemberTerms(id)`.
  All use the anon Supabase client (read-only, RLS-gated) and return safe
  defaults when Supabase is unconfigured, so pages render cleanly before
  ingestion has run.
- `lib/constants.ts` — US states list, party/chamber label maps,
  `congressStartYear()` helper.
- `app/layout.tsx` — minimal nav (CongressTracker ↔ Methodology) + footer
  with sourcing note.
- `app/page.tsx` — member list: GET-form filters (chamber / party / state /
  name search), a responsive table with photo/name/state/chamber/party, URL-
  param pagination. Empty state varies between "no data yet" and "no results
  for these filters".
- `app/member/[bioguideId]/page.tsx` — profile: photo, name, party badge,
  state, chamber, terms-served table split by chamber (Senate / House) with
  congress number / years / district / party, link to congress.gov,
  source-date note. Stub sections for votes (Phase 6) and promises (Phase 8)
  so the shape of the page is visible now. `notFound()` if bioguide_id is
  unknown.
- `app/_components/PartyBadge.tsx` — coloured badge (D=blue / R=red /
  I=purple / L=amber / Other=gray).
- `app/_components/MemberPhoto.tsx` — headshot with initials fallback.
- `next.config.mjs` — allows `www.congress.gov/img/member/**` for photos.

QA gate: `npm run build` clean (no errors, no lint warnings), `npm test`
48/48 passing. Both pages are `ƒ` (dynamic, server-rendered) with
`revalidate = 3600`.

### Phase 5 — Bills ingestion + bill pages (done)

Ingestion — `ingest/bills.ts`, `ingestBills(opts)` → `BillIngestResult`:
- Pages the `/v3/bill` (or `/v3/bill/{congress}`) list endpoint, then fetches
  each bill's DETAIL endpoint for sponsors / introduced date / policy area.
- **Cost controls** (the ~5k/day limit bites here): `withDetail` (default true,
  1 req/bill), `withCosponsors` (default false — cosponsors are a separate
  paged endpoint, even more requests), `maxCosponsorsPerBill`, `maxItems`.
- **Idempotent:** bills upsert on the `id` PK; sponsorships upsert on the
  `(bioguide_id, bill_id)` unique constraint (a plain constraint, so unlike
  terms we can use PostgREST `onConflict` directly).
- **FK safety:** sponsorships reference `members`; a bill can be sponsored by a
  former member not in our table, so rows are filtered to known member ids
  (loaded once via `loadMemberIds`, or supplied via `knownMemberIds`).
  Skipped rows are counted in `skippedSponsorships`, not errored.
- **De-dupe:** a member appearing twice for one bill is collapsed to avoid the
  "ON CONFLICT cannot affect row a second time" upsert error.
- `became_law` derived from the detail `laws[]` array or a "Became … Law"
  latest-action match (`detectBecameLaw`).
- Pure transforms (`makeBillId`, `transformBill`, `transformSponsors`,
  `transformCosponsor`, `detectBecameLaw`, `billDetailPath`) all exported +
  unit-tested.

UI:
- `app/bills/page.tsx` — bill list with congress / status (became law) / title
  filters and pagination.
- `app/bill/[id]/page.tsx` — bill detail: title, status, policy area, dates,
  latest action, congress.gov link, primary sponsor(s) + cosponsors linking to
  member profiles.
- Member profile gains a **Sponsored legislation** section (sponsored +
  cosponsored, linking to bill pages).
- `lib/queries.ts` adds `getBills`, `getBill`, `getBillSponsorships`
  (joins members), `getMemberSponsorships` (joins bills).
- `lib/constants.ts` adds `BILL_TYPE_LABELS`, `ordinal`, `congressGovBillUrl`.
- Nav gains Members / Bills / Methodology.

QA gate: `npm test` → 70/70 passing (32 new in `bills.test.ts`).
`npm run build` clean; routes `/bills` and `/bill/[id]` present.

### Phase 6 — Votes ingestion (done)

The messiest module, so parsing is isolated in pure functions and tested hard.

Two formats, two id schemes:
- **House** Clerk XML (`clerk.house.gov/evs/{year}/roll{NNN}.xml`) — voters carry
  Bioguide ids (`legislator name-id`). Resolve directly.
- **Senate** LIS XML (`senate.gov/.../vote_{c}_{s}_{NNNNN}.xml`) — voters carry
  **LIS ids** (`lis_member_id`), NOT Bioguide. Resolved via a deterministic
  LIS→Bioguide crosswalk (`members.lis_id`, added in migration **0002**).
  A vote with no crosswalk match is SKIPPED and counted, never attached to a
  name-guessed member (defamation is the top risk; we never guess identity).

`ingest/votes.ts`:
- Pure, exported, unit-tested: `normalizePosition` (Yea/Aye/Yes→yea, Nay/No→nay,
  Present, Not Voting; unknown→not_voting, never invented), `parseHouseDate`
  ("9-Jan-2023"→ISO), `parseSenateDate`, `parseSession` ("1st"→1),
  `billIdFromLegisNum` ("H R 3076"→"117-hr-3076"; non-bills→null),
  `houseRollCallUrl`/`senateRollCallUrl`, `parseHouseRollCall`,
  `parseSenateRollCall`, `toVoteRows`.
- `ingestVotes(opts)` walks roll numbers (explicit `endRoll`, or open-ended
  stopping after `maxConsecutiveMisses` 404s), parses, resolves ids, and upserts
  on the (bioguide_id, congress, chamber, session, roll_call) unique key.
  `fetchText` and the DB are injectable.
- Every row carries `source_url` (the XML url) — schema-enforced + asserted.

Migration **0002_member_lis_id.sql** adds `members.lis_id` (+ partial unique
index allowing many NULLs). Applied-and-validated against throwaway Postgres in
sequence with 0001.

UI: member profile gains a **Voting record** table (date, question, position
badge, bill link, and a per-row link to the source XML). `lib/queries.ts` adds
`getMemberVotes`; `app/_components/VotePositionBadge.tsx` added.

**Known dependency (not a bug):** Senate votes only resolve once `members.lis_id`
is populated (a LIS↔Bioguide crosswalk seed, e.g. from
unitedstates/congress-legislators). Until then Senate rows are skipped and
counted in `skippedUnresolved`. House votes need no crosswalk.

**Live fetch note:** clerk.house.gov / senate.gov are blocked by this session's
egress policy (same as api.congress.gov), so the live XML fetch can't run here;
parsing is fully covered by unit tests against real-shaped XML.

QA gate: `npm test` → 96/96 passing (26 new in `votes.test.ts`).
`npm run typecheck` + `npm run build` clean.

### Phase 9 — Polish (done)

The launch phase: the signature three-wing browse, a compare view, an
accessibility pass, and launch docs.

- **Three-wing browse — `/wings`:** the Ground-News-style split. Members are
  grouped into Left / Center / Right columns (from the sourced `current_wing`),
  with chamber/state filters, per-column totals, and a "See all N →" link into
  the filtered member list (`/?wing=…`). Column accents are neutral sky/stone/
  rose, deliberately not party blue/red. `getMembersByWing` runs one
  count+limit query per wing.
- **Compare — `/compare?a=&b=`:** two members side by side — party, state,
  chamber, wing + raw score, bills sponsored/cosponsored, votes recorded, recent
  yea/nay split, and promises tracked (kept/partial/broken). Member pickers are
  a plain GET form (`getMemberOptions`). Counts use head-only queries
  (`getMemberStats`); tallies use pure helpers in `lib/wings.ts`.
- **Pure helpers — `lib/wings.ts`:** `groupByWing`, `tallyVotes`,
  `tallyPromises`, `pct` — unit-tested in `lib/wings.test.ts`. The test script
  now globs `{ingest,lib}/**/*.test.ts`.
- **Accessibility:** skip-to-content link + `id="main"` landmark in the layout;
  the compare table uses `<caption>` + `scope`d row/col headers; nav gains Wings
  and Compare.
- **Methodology:** adds a "Limitations & corrections" section (descriptive not
  pejorative; data only as current as the last sync; unverified is not a claim;
  every figure links to its source for correction).
- **Launch:** `README.md` updated from the Phase-1 stub to reflect the full app,
  ingestion table, and project layout.

QA gate: `npm test` → 125/125 passing (4 new in `lib/wings.test.ts`).
`npm run typecheck` + `npm run build` clean; new routes `/wings`, `/compare`.

### Phase 8 — Promises (done)

Promises are the most defamation-sensitive data, so nothing here is
auto-generated (hard rules 1, 2, 5). Promises come only from a human — typed
into the reviewer tool or loaded from a seed file — and every promise carries a
source; every resolved verdict carries a reviewer + evidence.

Reviewer admin tool — `app/admin/page.tsx` (a `"use client"` island):
- Signs a reviewer in with Supabase Auth (email/password) using a new
  `createBrowserClient()` in `lib/supabase.ts` — the anon key with a PERSISTED
  session, so the reviewer's JWT rides along. Writes hit only `promises`, gated
  by RLS to the `authenticated` role; the service-role key is never used here.
- **Add a promise:** bioguide id + text + source_url (required); status starts
  `unverified`.
- **Review:** set status + rationale + evidence URL. The UI blocks a resolved
  status (kept/broken/partial/stalled) without an evidence URL, and attaches
  `reviewed_by` (the signed-in reviewer) + `reviewed_at` automatically — the
  same invariant the DB CHECK enforces. Degrades to a clear message when
  Supabase isn't configured. Reviewer accounts are provisioned in the Supabase
  dashboard (no self sign-up). Linked discreetly from the footer.

Seed loader — `ingest/promises.ts`:
- Pure, exported, unit-tested: `validatePromiseSeed` (requires bioguide_id +
  text + source_url; a resolved status requires reviewed_by + status_source_url,
  mirroring the DB), `loadPromiseSeeds` (partitions valid rows from rejections).
- `ingestPromises(opts)` is FK-safe (skips unknown members) and idempotent for
  seeds carrying a stable `id` (upsert on PK); id-less seeds are plain inserts.
- `supabase/seed/promises.example.json` is a TEMPLATE only — placeholder
  bioguide id `EXAMPLE0` is not a real member, so the loader skips it and
  nothing fabricated is ever inserted. Real promises replace the placeholders
  with genuine ids + source URLs.

Public UI:
- Member profile **Promises & record** section now renders real data as a
  promise/record split: left = the promise (text, topic, when/where, source);
  right = the reviewed verdict (status badge, rationale, evidence link), or
  "Not yet reviewed" for `unverified`. `lib/queries.ts` adds `getMemberPromises`.
- `app/_components/PromiseStatusBadge.tsx` + `PROMISE_STATUS_LABELS` /
  `PROMISE_STATUSES` in `lib/constants.ts`.

QA gate: `npm test` → 121/121 passing (9 new in `promises.test.ts`).
`npm run typecheck` + `npm run build` clean (new route `/admin`).

**Note:** Supabase Auth flow can't be exercised live in this session (no
configured project / egress blocked), but the page builds, typechecks, and the
seed/validation logic is fully unit-tested.

### Phase 7 — Wings + alignment scores (done)

Wing (left/center/right) must come from an external, published ideology metric,
never an invented partisan score (hard rule 3). We use **DW-NOMINATE** from
**Voteview** (https://voteview.com), whose per-congress member CSVs already
carry a `bioguide_id`, so the crosswalk to our `members` table is direct (no
LIS-style mismatch as with Senate votes).

`ingest/scores.ts`:
- Pure, exported, unit-tested: `parseCsv` (RFC-4180-ish — handles quoted
  fields with embedded commas like `"OCASIO-CORTEZ, Alexandria"`, doubled-quote
  escapes, CRLF), `parseVoteviewMembers` (keys columns by header name, so column
  re-ordering won't break it; a missing score stays `null`, never coerced to 0),
  `classifyWing` (symmetric cutoff: dim1 ≤ −t → left, ≥ t → right, else center),
  `mapVoteviewChamber`, `voteviewMembersUrl`, `toAlignmentRows`.
- `classifyWing` uses `DW_NOMINATE_CENTER_THRESHOLD` (0.25) from `lib/constants.ts`
  — one source of truth shared with the methodology page.
- **Never guesses:** a member with no published DW-NOMINATE score gets NO wing
  (counted as `skippedNoScore`). FK-safe like bills/votes: rows for members not
  in our table are skipped (`skippedUnknownMember`).
- `ingestScores(opts)` fetches the House and/or Senate CSV for a congress,
  upserts `alignment_scores` on (bioguide_id, congress, metric), then refreshes
  the denormalised `members.current_wing` cache in ≤3 batched UPDATEs (one per
  wing). `fetchText` + DB are injectable.
- Every row carries `source_url` (the exact Voteview CSV) + `methodology_url`
  (`/methodology`) — schema-enforced and asserted in tests.

UI:
- `app/_components/WingBadge.tsx` — neutral slate/sky/rose palette (deliberately
  NOT party blue/red), so the wing reads as a sourced ideology bucket.
- Member list (`/`) gains a **wing filter** + a Wing column; `getMembers`
  filters on `current_wing`.
- Member profile gains a **Political alignment** card: wing badge, the raw
  dimension-1 score, congress, the −1…+1 scale, and links to the source dataset
  + `/methodology`. `lib/queries.ts` adds `getMemberAlignment` (latest score).
- `/methodology` now documents the exact bucketing rule (the ±0.25 cutoff) and
  states the raw score is always shown and unscored members get no wing.

**Live fetch note:** voteview.com is reachable in principle, but this session's
egress policy blocks external hosts (same as congress.gov / clerk.house.gov), so
the live CSV fetch can't run here; parsing is fully covered by unit tests against
real-shaped CSV. To populate: run `ingestScores({ congress: 118, ... })` from an
environment with network + the service-role key.

QA gate: `npm test` → 112/112 passing (16 new in `scores.test.ts`).
`npm run typecheck` + `npm run build` clean (routes `/`, `/member/[bioguideId]`,
`/methodology` updated).

### Phase 3 — Members ingestion (done)

- `ingest/members.ts` exports `ingestMembers(opts)` → `IngestResult`.
- **Incremental sync:** pass `fromDateTime` (ISO-8601) to only fetch members
  whose `updateDate` is at or after that value — keeps daily request usage low.
  Store the highest `source_updated_at` from each run and use it next time.
- **Idempotent:** members are upserted with `onConflict: 'bioguide_id'`.
  Terms use delete-then-insert per batch (the `coalesce(district,-1)` expression
  index on `terms` cannot be targeted by PostgREST's `onConflict` parameter).
- **Batching:** 250 items per Congress.gov page; 100 rows per Supabase upsert/
  insert to stay within PostgREST body limits.
- **Handles API shape quirks:** terms come back as `{ item: [...] }` or a bare
  array — both handled. Member names are inverted ("Last, First") and parsed.
  Party names ("Democratic", "Democrat", "Republican", …) are mapped to the
  `party` enum. Chamber strings ("House of Representatives", "Senate") are
  mapped to `chamber`.
- **Testable:** `CongressClient` and Supabase client are both injectable.
  All transformation functions are pure and exported.
- **QA gate (passed):** `npm test` → 48/48 passing (includes Phase 2 suite).
  `npm run typecheck` clean.
