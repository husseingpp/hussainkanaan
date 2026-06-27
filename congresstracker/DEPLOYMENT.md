# Deploying CongressTracker

CongressTracker reads Supabase with the anon key (RLS-gated read-only), which
works from both a server and the browser, so there are two supported hosts:

- **Vercel** — server-rendered, with a cron-driven sync. Zero extra config.
- **GitHub Pages** — a live static export: a static shell that fetches Supabase
  in the browser, kept fresh by a scheduled GitHub Action. No server.

Sections 1–5 cover Vercel; [section 6](#6-github-pages-live-static-export) covers
GitHub Pages. The app lives in the `congresstracker/` subdirectory of this repo,
which matters for the Vercel **Root Directory** below.

## 1. Prerequisites

- A **Supabase** project with the migrations applied
  (`supabase/migrations/0001_init.sql`, then `0002_member_lis_id.sql`).
- A **Congress.gov** API key (free: https://api.data.gov/signup/).
- The values for the env vars below (see `.env.example`).

> Security: if any keys were ever committed, rotate them before going live —
> especially `SUPABASE_SERVICE_ROLE_KEY`, which bypasses Row Level Security.

## 2. Import the repo on Vercel

1. Vercel → **Add New… → Project** → import this Git repository.
2. **Root Directory:** set to `congresstracker`. *(This is the only non-default
   setting. Vercel auto-detects Next.js for framework, build, and output.)*
3. Add **Environment Variables** (Production + Preview):

   | Variable | Where it's used | Public? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes (exposed to browser) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public reads (RLS) | yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | ingestion / cron only | **no — server only** |
   | `CONGRESS_API_KEY` | ingestion / cron only | no |
   | `CRON_SECRET` | guards `/api/cron/sync` | no |
   | `CURRENT_CONGRESS` *(optional)* | overrides auto-detected congress | no |

4. **Deploy.** Once it's live the member list, profiles, wings, compare, bills,
   methodology, and the `/admin` reviewer tool all work against Supabase.

## 3. The scheduled sync (cron)

`vercel.json` registers a daily cron hitting `/api/cron/sync?tasks=members`.
Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` to cron
requests once `CRON_SECRET` is set, which is how the endpoint authorises the
call. The default job is a cheap incremental members sync (records changed in
the last ~2 days; upserts are idempotent).

Trigger any sync manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-deployment>/api/cron/sync?tasks=members,scores"
```

Supported `tasks`: `members`, `scores`. Bills and votes are heavier (they spend
much more of the ~5,000 req/day Congress.gov budget and can exceed a serverless
timeout), so run those manually — see below.

## 4. First data load (one-time)

The cron only does incremental members + scores. To populate everything the
first time, run the ingestion locally (or from any Node box) with the same env
vars in `.env.local`. Example using `tsx`:

```ts
// scripts/seed.ts (example — write to taste)
import { ingestMembers } from "../ingest/members.ts";
import { ingestBills } from "../ingest/bills.ts";
import { ingestVotes } from "../ingest/votes.ts";
import { ingestScores } from "../ingest/scores.ts";

const env = {
  apiKey: process.env.CONGRESS_API_KEY!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

await ingestMembers({ ...env, currentMember: true });
await ingestScores({ supabaseUrl: env.supabaseUrl, supabaseServiceKey: env.supabaseServiceKey, congress: 119 });
await ingestBills({ ...env, congress: 119, maxItems: 500 });
await ingestVotes({ supabaseUrl: env.supabaseUrl, supabaseServiceKey: env.supabaseServiceKey, chamber: "house", congress: 119, session: 1, year: 2025, endRoll: 50 });
```

Mind the rate limit: page incrementally and prefer `fromDateTime` on re-runs.

Senate votes only resolve once `members.lis_id` is populated (a LIS↔Bioguide
crosswalk, e.g. from `unitedstates/congress-legislators`); until then Senate
roll-call voters are skipped, never name-guessed.

## 5. Reviewer accounts (promises)

The `/admin` tool signs reviewers in with Supabase Auth (email/password). Create
reviewer accounts in the Supabase dashboard (Authentication → Users) — there is
no public sign-up. RLS lets the `authenticated` role write only `promises`.

## 6. GitHub Pages (live static export)

GitHub Pages serves static files only, but the site stays **live** because every
page fetches Supabase in the browser with the anon key (read-only via RLS). A
scheduled GitHub Action keeps the data fresh — no server, and a successful sync is
visible immediately without a rebuild. Trade-off vs. Vercel: client-side
rendering (weaker SEO / first paint), and per-member/bill pages are pre-listed at
build time (a member added after the last build 404s until the next build).

This repo already wires it up — there is nothing to write, only secrets to set:

1. **Build & publish.** `.github/workflows/deploy.yml` (the portfolio's Pages
   workflow) installs CongressTracker, runs `npm run build:static`, and injects
   the result into `out/congresstracker/`. The site is served at
   `https://<user>.github.io/hussainkanaan/congresstracker/` — which is why the
   static build sets `basePath`/`assetPrefix` to `/hussainkanaan/congresstracker`
   (see `next.config.mjs`, gated by the `STATIC_EXPORT` env var).

2. **Repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Used by | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Pages build + sync | public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pages build (baked into bundle) | public, RLS read-only |
   | `SUPABASE_SERVICE_ROLE_KEY` | sync only | **secret** — bypasses RLS |
   | `CONGRESS_API_KEY` | sync only | secret |

   The anon key is *meant* to ship to the browser; the service-role key is used
   only inside the Action runner, never in the static bundle.

3. **Scheduled sync.** `.github/workflows/congresstracker-ingest.yml` runs daily
   (and on demand via *Run workflow*), executing `scripts/sync.ts` — the same
   incremental members + scores sync as the Vercel cron. Run the heavier
   first-load (bills, votes) manually as in section 4. Without the secrets above
   the Action no-ops rather than failing.

Build it locally to preview the exact artifact:

```bash
npm run build:static   # writes ./out (set NEXT_PUBLIC_SUPABASE_* to include data)
npx serve out          # note: basePath means open /hussainkanaan/congresstracker/
```
