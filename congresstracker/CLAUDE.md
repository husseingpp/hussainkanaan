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
   pages.
6. **Votes ingestion** — `ingest/votes.ts` (House/Senate XML). This is the
   messiest module; isolate it and test parsing hard.
7. **Wings + scores** — classification + `ingest/scores.ts` → `alignment_scores`.
8. **Promises** — admin review tool (`/admin`) + seed data; promise/record
   split view on profiles.
9. **Polish** — three-wing UI, `/compare`, `/methodology`, accessibility, launch.

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
