# Multilingual NGO Platform

A content website for an NGO: **Arabic first (RTL), English second**, and more
languages the owner can add at runtime. The owner controls both the content
(activities with photo albums, invitations & conferences, sectors, objectives,
pages) and the look (theme, homepage sections, menu) through a simple admin.

- **Spec:** [`BLUEPRINT.md`](./BLUEPRINT.md) is the source of truth.
- **Working rules:** [`CLAUDE.md`](./CLAUDE.md).
- **Preview:** https://husseingpp.github.io/hussainkanaan/ngo-platform/
  (static build of the hosted database; the real deployment targets Cloudflare Workers).

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold: Next.js 15, Tailwind v4, shadcn, next-intl loader, Supabase local, deploy config | ✅ `/ar` RTL + `/en` LTR; GitHub Pages preview. Cloudflare deploy configured, not yet live |
| 1 | Database: migrations, RLS, seed, pgTAP | ✅ 5 migrations, RLS on every table, 78 pgTAP tests |
| 2 | Public site | ✅ theme from DB, dynamic menu, 13 section types, all public routes, sitemap + hreflang; Lighthouse mobile 91–96 |
| 3 | Admin core + content | ✅ sign-in (email link / password), posts with 20-photo albums, sectors, objectives, pages, media library |
| 4 | Appearance | ⏳ |
| 5 | Languages | ⏳ |
| 6 | Requests module | 🟡 form builder (Google-Forms style), public apply + track pages, responses inbox with status/notes/history. Turnstile + staff email come with Cloudflare |
| 7 | Hardening & handover | ⏳ |

## Getting started

Requires Node 20+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local
pnpm dev                     # http://localhost:3000 → redirects to /ar
pnpm lint && pnpm typecheck && pnpm build
```

Supabase (local, needs Docker):

```bash
pnpm supabase start          # Postgres + auth + storage, applies migrations + seed
pnpm supabase db reset       # re-apply from scratch
pnpm test:db                 # pgTAP RLS tests
pnpm db:types                # regenerate src/types/database.ts after a migration
pnpm seed:ui-strings         # regenerate supabase/seeds/ui_strings.sql after editing defaults/*.json
```

## Database (Phase 1)

| Migration | Contents |
|---|---|
| `…01_base` | enums, `i18n` jsonb domain, `updated_at` trigger, `profiles`, role helpers (`is_admin`, `is_editor`, `is_case_worker`, `is_staff`) |
| `…02_site` | `locales` (one default), `ui_strings`, `site_settings` (modules: admin-only), `theme`, `nav_items` (one dropdown level), `hero_slides`, `page_sections`, SQL `tr()` |
| `…03_content` | `media`, `sectors`, `objectives`, `posts` + `post_sectors` + `post_media` (albums), `pages` |
| `…04_requests` | `request_types`, `requests`, append-only `request_events` (written by triggers), rate-limited `check_request_status()` |
| `…05_storage` | `public-images` bucket: public read, editor/admin write |
| `…0001_submit_request` | `submit_request()` RPC: validates answers against the form's questions, rate-limited (5 / 10 min per client), returns the tracking code |

Public sign-up is disabled: an admin creates staff users and their `profiles` row.
A signed-in user without an active profile only gets public access.

## How i18n works (Phase 0)

- Locales and UI strings are shaped like their future DB rows (`locales`,
  `ui_strings`). For now they're loaded from `src/lib/i18n/defaults/`; Phase 1
  swaps the two fetch functions for cached Supabase queries.
- Keys are flat and dotted (`home.hero.title`) so they map 1:1 to `ui_strings.key`.
- `<html lang dir>` comes from the locale row. Physical direction utilities
  (`ml-*`, `text-right`…) are rejected by ESLint; use logical ones.
- The theme is injected as CSS variables on `<html>` (`src/lib/theme`).

## Public site (Phase 2)

- Every page reads through `src/lib/data/*` (cached, tagged by `lib/cache.ts`).
  With Supabase configured, a failed query **fails the build**, so a broken build
  never replaces a working site; without Supabase, the site builds from the
  code defaults.
- The homepage is `page_sections` rendered by `components/sections/registry.ts`;
  each type's settings are parsed with its Zod schema (`lib/validation/sections.ts`).
- Listing filters (`?sector=&year=&page=`) run client-side, so they also work on static hosting.

### Preview database and demo content

The preview is built from the hosted Supabase project `ngo-platform`
(`kgfyxsqfwtjxmbvqemsw`, Frankfurt). It holds the Phase 1 schema, the seed, and
**demo content** (sample activities, events, hero slides, stats) with original
placeholder images from `public/demo/`:

```bash
node scripts/demo-sql.mjs https://husseingpp.github.io/hussainkanaan/ngo-platform > demo.sql   # generate
# remove it all again: supabase/demo-cleanup.sql
```

The Pages workflow rebuilds every hour (or on **Run workflow**), so edits made
in the admin show up on the public site without a code push.

### Staff accounts

Public sign-up is off. A staff member is an Auth user plus a `profiles` row with a
role. The first admin was created directly in the hosted project; inviting more
staff from the admin comes later (Users & roles).
New staff get a temporary password and `profiles.must_change_password = true`: the
admin then shows only a "choose your own password" screen until they set one (a
trigger on `auth.users` clears the flag when the password actually changes).

## Admin (Phase 3)

`/admin` — Arabic UI by default, switchable to English (or any enabled language) from the sidebar; the choice is remembered per browser. Sign in with an emailed link (or a password set under
**حسابي**). Content: posts (activities / events / news) with locale tabs, Tiptap
body, cover, album uploader (compressed to WebP ≤1600px, drag to reorder, caption
per locale), sectors, objectives, pages, media library, and **Settings** (organization name and tagline per language, logo / dark logo / favicon, contacts, socials, footer, donation info; modules are admin-only).

**How it talks to the database.** On static hosting there's no server, so the
admin runs in the browser with the signed-in user's session and **RLS is the
security boundary** (103 pgTAP tests). All reads/writes go through `src/lib/admin/*`,
which return `{ ok, data } | { ok, error }` and validate with the Zod schemas in
`src/lib/validation/content.ts`. On Cloudflare these functions can become server
actions without touching the screens. Album + sector links are replaced atomically
by the `set_post_links` RPC (security invoker).

### Forms & requests

Switch on **Settings → Optional features → Requests** (admin only). Then:

- **Forms** (`/admin/forms`, admin): build a form like Google Forms: add questions
  (short/long text, number, email, phone, date, dropdown, single choice, checkboxes),
  mark them required, translate each label, reorder by dragging, preview, open/close.
  Every form also asks for full name + phone (used for tracking) and consent.
- **Public**: `/{locale}/apply` lists open forms, `/{locale}/apply/form?type=<slug>`
  fills one and shows a tracking code, `/{locale}/track` checks status by code + phone.
  Submissions go through the `submit_request` RPC; requests are never publicly readable.
- **Responses** (`/admin/requests`, admin + case worker): filter by form/status, open a
  response to change status, priority, assignee, a note shown to the applicant, and
  internal notes. Every change is logged in `request_events`.

When the module is off, `/apply` and `/track` 404 and the admin entries are hidden.

**Supabase Auth settings** (dashboard → Authentication → URL Configuration) must
allow the admin URL as a redirect, e.g.
`https://husseingpp.github.io/hussainkanaan/ngo-platform/**`.

## Deploying

- **Preview (now):** `pnpm build:static` with `NEXT_PUBLIC_BASE_PATH` set
  produces `out/`. The portfolio's GitHub Pages workflow builds and publishes
  it under `/ngo-platform/`.
- **Production (later):** `pnpm run deploy` builds with OpenNext and deploys to
  Cloudflare Workers (`wrangler.jsonc`). It needs a Cloudflare account; the
  custom domain is attached in the Cloudflare dashboard. The static preview
  can't run the admin, server actions or ISR, so from Phase 3 on testing moves
  to Cloudflare (a free `*.workers.dev` URL works before the domain is bought).
