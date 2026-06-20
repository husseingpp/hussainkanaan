# CLAUDE.md — Atlas of History

Single source of truth for this project. Read this fully before any work.

## What we're building

A 3D interactive globe where users drop pins on countries. Each pin holds a
historical fact: title, body, optional year, an image, and a reference link
(Wikipedia or any URL). Users can browse by country, click pins to read facts,
and filter facts across time with a year slider.

## Working rules (do not skip)

1. **Plan Mode before any code.** Present the plan, wait for approval.
2. **This file is the single source of truth.** If reality diverges from this
   file, update this file in the same session.
3. **One phase per session.** Do not start the next phase until the current
   phase passes its QA gate and I approve.
4. **Use `react-globe.gl`** for the globe. Do NOT hand-roll Three.js.
5. **No secrets in code.** All keys via `.env` (Vite `VITE_` prefix).
6. Run the QA checklist at the end of every phase and report pass/fail per item.

## Stack

- Build: Vite + React + TypeScript
- Globe: `react-globe.gl` (wraps globe.gl + Three.js)
- Country geometry: `world-atlas` (countries-110m TopoJSON) + `topojson-client`
- Point-in-polygon country detection: `d3-geo` (`geoContains`)
- Styling: Tailwind CSS
- Backend: Supabase (Postgres + Storage + Auth)
- Deploy: GitHub Pages (see Deploy section)

## Project location

The Atlas of History app lives at `atlas-of-history/` within this monorepo.

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Data model (Supabase Postgres)

Table: `facts`

| column          | type             | notes                                  |
|-----------------|------------------|----------------------------------------|
| id              | uuid pk          | default gen_random_uuid()              |
| country_code    | text             | ISO A3 (e.g. "FRA")                    |
| country_name    | text             |                                        |
| title           | text             | required                               |
| body            | text             | required                               |
| year            | int              | nullable; used by timeline filter      |
| lat             | double precision | required                               |
| lng             | double precision | required                               |
| image_url       | text             | nullable; Supabase Storage public URL  |
| reference_url   | text             | nullable                               |
| reference_label | text             | nullable; e.g. "Wikipedia"             |
| created_by      | uuid             | references auth.users                  |
| created_at      | timestamptz      | default now()                          |

### SQL setup

```sql
create extension if not exists "pgcrypto";

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  country_name text,
  title text not null,
  body text not null,
  year int,
  lat double precision not null,
  lng double precision not null,
  image_url text,
  reference_url text,
  reference_label text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table public.facts enable row level security;

create policy "facts are readable by everyone"
  on public.facts for select using (true);

create policy "users insert their own facts"
  on public.facts for insert
  with check (auth.uid() = created_by);

create policy "users update their own facts"
  on public.facts for update using (auth.uid() = created_by);

create policy "users delete their own facts"
  on public.facts for delete using (auth.uid() = created_by);

create index facts_country_code_idx on public.facts (country_code);
create index facts_year_idx on public.facts (year);
```

### Storage

Bucket: `fact-images` (public read). Upload images here; store the returned
public URL in `facts.image_url`.

## Architecture

```
App
├── Globe (react-globe.gl)
│     ├── pointsData = filteredFacts        // one pin per fact
│     ├── onGlobeClick({lat,lng})           // → resolve country → AddFactPanel
│     └── onPointClick(fact)                // → FactCard
├── Sidebar
│     ├── search / CountryList
│     └── TimelineSlider                    // year range filter
├── FactCard            // read: image, body, reference link
└── AddFactPanel        // create / edit → Supabase
```

### Country detection

On `onGlobeClick`, take `{lat,lng}`, load countries-110m features once, and
find the feature where `d3-geo`'s `geoContains(feature, [lng, lat])` is true.
Map its properties to `country_code` (ISO A3) and `country_name`. If no match
(ocean), prompt the user to click on land.

## Suggested file structure

```
atlas-of-history/
  src/
    lib/supabase.ts        // client
    lib/countries.ts       // load topojson, geoContains helper
    data/sampleFacts.ts    // Phase 1 only
    hooks/useFacts.ts      // fetch + realtime + filter state
    components/
      GlobeView.tsx
      Sidebar.tsx
      TimelineSlider.tsx
      FactCard.tsx
      AddFactPanel.tsx
    App.tsx
```

## Writing / copy conventions

- Sentence case, plain verbs. Buttons say the action: "Add fact", "Save fact".
- Empty state on globe with no facts: invite action, e.g. "Click a country to
  add the first fact."
- Errors state what failed and how to fix. No apologies, no vague messages.
- Reference link reads "Read on Wikipedia →" when host is wikipedia, else the
  reference_label or "Open reference →".

## Build phases

Each phase is one session. End each with the QA gate below.

### Phase 1 — Scaffold ✅ COMPLETE
- Vite + React + TS + Tailwind set up and running.
- Render an interactive, auto-rotating globe centered on screen.
- 3–4 hardcoded sample pins from `data/sampleFacts.ts`.
- Layout shell: globe center, collapsible right sidebar (empty for now).
- No backend yet.

### Phase 2 — Supabase wiring ✅ COMPLETE
- Supabase project: `atlas-of-history` (id: `ltidmmvudancwnrxglud`, region: eu-west-1).
- Schema applied via MCP migration: `facts` table + RLS policies + indexes.
- `fact-images` storage bucket created (public read) with upload/update/delete policies.
- `src/lib/supabase.ts` — client initialised from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `src/hooks/useFacts.ts` — fetches all facts + realtime INSERT/UPDATE/DELETE subscription.
- `src/components/AuthPanel.tsx` — email magic-link sign-in / sign-out.
- Sidebar header shows auth state and fact count; App shows loading/error banners.
- `.env` holds real credentials (gitignored); `.env.example` documents the vars.

### Phase 3 — Add / Edit flow ✅ COMPLETE
- `src/lib/countries.ts` — loads countries-110m TopoJSON once, `detectCountry(lat,lng)`
  uses `d3-geo` `geoContains`; numeric id → ISO A3 via `i18n-iso-countries`
  (`numericToAlpha3`), `country_name` from feature `properties.name`. Returns null
  over ocean.
- `onGlobeClick` resolves the country, drops a cyan draft pin, and opens
  `AddFactPanel` prefilled with lat/lng + detected country. Ocean clicks show a
  transient "Click on land to add a fact." hint.
- `AddFactPanel.tsx` — form: title*, body*, year (negative = BCE), image upload to
  `fact-images` (`${user.id}/${uuid}.${ext}` → public URL), reference_url + label.
  Insert sets `created_by = user.id`. Signed-out users see a sign-in prompt.
- Edit + delete for owned facts: Sidebar shows "Edit fact" when
  `selectedFact.created_by === user.id`; the edit panel holds the Delete action.
- `useFacts` now exposes `upsertFact` / `removeFact` and merges realtime events by
  id, so new/edited/deleted pins update with no reload (realtime also enabled on the
  `facts` table via `alter publication supabase_realtime add table facts`).

Dependency added: `i18n-iso-countries` (numeric→A3 mapping; world-atlas features
only carry numeric ISO ids + name).

### Phase 4 — Read experience ✅ COMPLETE
- `src/components/FactCard.tsx` — fact detail (image, country + year, title, body,
  reference link with Wikipedia-aware label, Edit button for owned facts). Opened
  via `onPointClick`.
- `src/components/CountryList.tsx` — search box + countries derived from the
  filtered facts (unique, A→Z, count badge). Selecting a country flies the globe to
  the centroid of its facts; a single-fact country opens directly.
- Sidebar now switches between `CountryList` (browse) and `FactCard` (read).
- `GlobeView` gains a `flyTo` prop → `pointOfView` animation (1s).
- Search (`query` in App) filters the globe pins and the country list together.
- Stacked pins: `clusterOffset` in App spreads facts sharing coordinates into a
  small ring so each stays clickable.

### Phase 5 — Timeline + polish + deploy ✅ COMPLETE
- `src/components/TimelineSlider.tsx` — dual-thumb year range slider (BCE/CE labels,
  highlighted segment, Reset). Lives as a persistent footer in the Sidebar; hidden
  when there are no dated facts, collapses to a label when all facts share one year.
- App filter pipeline: `facts → search → year range → clusterOffset → globe`. Undated
  facts are always shown; the slider only constrains dated facts. Year bounds derive
  from the dated facts; `yearRange = null` means "full range" (no filter).
- Reduced motion: `matchMedia('(prefers-reduced-motion: reduce)')` (with change
  listener) pauses globe auto-rotation; a CSS block also neutralises animations/
  transitions. Globe drag/zoom still work.
- Accessibility: global `:focus-visible` outline; slider thumbs and all controls show
  a visible keyboard-focus ring.
- States: loading spinner, error banner, empty globe hint, "No facts match the current
  filters" when search/timeline empties the globe, and empty country-list copy.
- Deploy: **GitHub Pages** (not Vercel — see deploy note below). Live at
  `/hussainkanaan/atlas-of-history/` via `.github/workflows/deploy.yml`.

## Deploy

Deployed to **GitHub Pages** (the repo already had a Pages workflow; Vercel was not
used). The Pages site root is `/hussainkanaan/`, so Vite `base` is
`/hussainkanaan/atlas-of-history/`. The deploy workflow runs `cp .env.example .env`
before `vite build`; `.env.example` carries the public Supabase URL + anon/publishable
key (safe to commit). App URL: `https://husseingpp.github.io/hussainkanaan/atlas-of-history/`.

## QA gate checklist (run at end of every phase)

- [ ] `npm run build` passes with no type errors.
- [ ] No secrets committed; `.env` is gitignored.
- [ ] Globe renders and is interactive (drag, zoom).
- [ ] No console errors on load or primary interaction.
- [ ] New code matches this file; this file updated if anything changed.
- [ ] Phase-specific acceptance (the bullet list for the current phase) all met.
- [ ] Responsive check at 375px width.

## Open questions / decisions log

- Auth model: anonymous vs required email — default to email magic link;
  revisit if friction is too high.
- Multiple facts at same coordinates: RESOLVED (Phase 4) — `clusterOffset` spreads
  co-located pins into a small ring (0.4° radius) so each stays individually
  clickable.
