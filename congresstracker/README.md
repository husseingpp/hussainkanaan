# CongressTracker

Non-partisan accountability for every member of the US Congress: who they are,
what they **promised** before being elected, and what they **actually did** in
office (votes, sponsored bills, bills passed). Browse the same member through a
**Left / Center / Right** lens, Ground News style.

> The product only has value if people trust it. **Every factual claim about a
> real person is traceable to a source — enforced by the database schema, not
> just the UI.** See [`CLAUDE.md`](./CLAUDE.md) for the full spec and hard rules.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + RLS)
· Vercel. Data from [`api.congress.gov`](https://api.congress.gov) plus House
Clerk / Senate roll-call XML.

## Status

All nine build phases are implemented (see the build order and per-phase notes
in [`CLAUDE.md`](./CLAUDE.md)):

- **Schema + RLS** — seven tables with source-provenance enforced in the DB.
- **Ingestion** — a rate-limited Congress.gov client, plus members, bills,
  votes (House/Senate roll-call XML), and DW-NOMINATE alignment scores.
- **Public UI** — member list with filters, member profiles (terms, sponsored
  legislation, voting record, political alignment, promises), bill list +
  detail, a **Left / Center / Right** browse view (`/wings`), and a side-by-side
  **`/compare`**.
- **Promises** — a reviewer tool (`/admin`) where humans enter sourced promises
  and record source-backed verdicts; nothing about a person is auto-generated.
- **Methodology** — `/methodology` documents sourcing, the wing cutoff, and
  limitations.

Pages are server-rendered against Supabase; deploy on a Node host (Vercel).
GitHub Pages cannot host it (static export only).

## Getting started

Requires Node.js 18.17+ (Node 20+ recommended).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Database

The full schema lives in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

Apply it to a Supabase project either with the Supabase CLI:

```bash
supabase db push
```

or by pasting the migration into the Supabase SQL editor.

### What the schema guarantees

- `members` · `terms` · `bills` · `sponsorships` · `votes` · `promises` ·
  `alignment_scores`.
- `votes.source_url` and `promises.source_url` are **mandatory** (`NOT NULL` +
  non-empty) — no source, no row.
- `promises.status` defaults to `unverified`; marking a promise `kept` /
  `broken` / `partial` requires a **reviewer** and a **status source URL**.
- **Row Level Security:** public (anon) access is read-only on every table.
  Promise create/update is limited to authenticated reviewers. Ingestion jobs
  use the service-role key, which bypasses RLS.

### QA gate (before starting Phase 2)

With the anon key, confirm:

1. `SELECT` works on every table.
2. `INSERT` / `UPDATE` / `DELETE` are rejected on every table.
3. A `promises` insert without `source_url` fails.
4. Setting a promise to `broken` without `reviewed_by` + `status_source_url`
   fails.

## Ingestion

Ingestion modules live in [`ingest/`](./ingest) and write with the service-role
key. All transforms are pure and unit-tested (`npm test`); the network and
Supabase clients are injectable, so the suite runs offline.

| Module | Source | Populates |
| --- | --- | --- |
| `members.ts` | api.congress.gov | `members`, `terms` |
| `bills.ts` | api.congress.gov | `bills`, `sponsorships` |
| `votes.ts` | House Clerk / Senate roll-call XML | `votes` |
| `scores.ts` | Voteview DW-NOMINATE CSV | `alignment_scores`, `members.current_wing` |
| `promises.ts` | hand-authored seed (`supabase/seed/promises.example.json`) | `promises` |

Senate votes resolve through a LIS↔Bioguide crosswalk (`members.lis_id`, see
migration `0002`); unresolved voters are skipped, never name-guessed.

## Environment

See [`.env.example`](./.env.example): `CONGRESS_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server-only).

## Deploy

Server-rendered, so it needs a Node host — **Vercel** (SSR + cron, no extra
config). Import the repo, set **Root Directory = `congresstracker`**, add the env
vars, and deploy. A daily incremental sync runs via Vercel Cron
(`/api/cron/sync`, guarded by `CRON_SECRET`). Full step-by-step in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Project layout

```
congresstracker/
├── app/                       # Next.js App Router
│   ├── page.tsx               # Member list + filters
│   ├── member/[bioguideId]/   # Member profile
│   ├── bills/, bill/[id]/     # Bill list + detail
│   ├── wings/                 # Left / Center / Right browse
│   ├── compare/               # Side-by-side comparison
│   ├── admin/                 # Reviewer tool (promises)
│   ├── methodology/           # Sourcing, classification, limitations
│   └── _components/           # Badges, photo, etc.
├── ingest/                    # Ingestion modules + unit tests
├── lib/
│   ├── supabase.ts            # anon / browser-auth / service-role clients
│   ├── queries.ts             # Read helpers (RLS-gated)
│   ├── wings.ts               # Pure grouping/tally helpers
│   ├── constants.ts           # Labels, wing cutoff, etc.
│   └── database.types.ts      # TS mirror of the schema
├── supabase/
│   ├── migrations/            # 0001 schema + RLS, 0002 lis_id
│   └── seed/                  # promises.example.json (template)
└── CLAUDE.md                  # Single source of truth (spec + hard rules)
```
