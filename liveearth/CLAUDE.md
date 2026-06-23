# CLAUDE.md — Live Earth Events Globe

> Single source of truth for this project. Read this fully before any code. Follow the session discipline at the bottom.

---

## 1. What we're building

A web app that shows **current natural events happening around the world** on an interactive **3D globe**. Events are pulled from NASA's **EONET v3 API** (wildfires, volcanoes, storms, floods, etc.), plotted as glowing markers on the globe at their real coordinates. Clicking a marker opens a detail panel. Filters let the user narrow by category and status.

Working name: **LiveEarth**.

### Core user stories

1. As a visitor, I land on the page and see a rotating 3D Earth with live event markers already plotted.
2. I can filter events by category (e.g. only volcanoes) and by status (open / closed).
3. I click a marker and see the event's title, category, date, source link, and coordinates.
4. The globe auto-refreshes data on an interval so it stays "live."
5. On mobile the globe is touch-draggable and the UI is responsive.

### Explicit non-goals (v1)

- No user accounts / auth / database. The app is read-only against NASA's API.
- No backend persistence. (A thin proxy is optional — see §6.)
- No historical timeline scrubber (deferred to v2).

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fast |
| Framework | **React 18 + TypeScript** | Component model + type safety |
| Globe | **react-globe.gl** (wraps globe.gl / three.js) | Points layer is built for exactly this |
| Data fetching | **TanStack Query (React Query)** | Caching, auto-refetch interval, loading/error states for free |
| Styling | **Tailwind CSS** (v3) | Fast, consistent |
| HTTP | native `fetch` | No axios needed |
| State (filters) | React state / URL search params | Filters are simple |

No paid services. NASA EONET requires **no API key**.

---

## 3. The EONET v3 API (everything you need)

Base URL: `https://eonet.gsfc.nasa.gov/api/v3`

### Endpoints we use

**Events** (the main one):

```
GET /events?status=open&limit=200
```

Optional query params:

- `status` — `open` (active) or `closed`. Omit to get both.
- `category` — category id (e.g. `wildfires`). Filter server-side.
- `limit` — max events returned.
- `days` — events from the last N days.

**Categories** (to build the filter dropdown):

```
GET /categories
```

### Event object shape

See `src/types/eonet.ts` for the authoritative TypeScript interfaces.

### Critical data-handling rules

- **Coordinates are `[longitude, latitude]`** — NOT lat/lng. react-globe.gl wants `{ lat, lng }`. You must swap them. This is the #1 bug to avoid. (Handled in `src/lib/transform.ts`.)
- An event's `geometry` array can hold **many points** (a storm's track over days). For markers, use the **last/most-recent geometry entry** as the event's current position.
- Some geometries are `Polygon`, not `Point`. When type is `Polygon` take the first coordinate ring's first point so it still plots. Don't crash on it.
- Categories: fetched live from `/categories` rather than hardcoded.

### The known gotcha: CORS

NASA's EONET API **does send permissive CORS headers**, so direct browser `fetch` works in most cases. If you hit a CORS or rate issue, add the optional thin proxy in §6. **Try direct first.**

---

## 4. Project structure

```
liveearth/
├── CLAUDE.md                  ← this file
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/eonet.ts           ← fetch fns + response typing
    ├── hooks/
    │   ├── useEvents.ts       ← React Query hook, refetch interval
    │   └── useCategories.ts
    ├── lib/transform.ts       ← EonetEvent[] → GlobePoint[] (coord swap, color)
    ├── types/eonet.ts         ← interfaces from §3
    ├── components/
    │   ├── Globe.tsx          ← react-globe.gl wrapper
    │   ├── FilterBar.tsx      ← category + status filters
    │   ├── EventPanel.tsx     ← detail panel on marker click
    │   ├── StatsBar.tsx       ← total / active / closed counts
    │   └── Legend.tsx         ← color → category legend
    └── styles/index.css
```

---

## 5. Build plan — phases

- **Phase 0 — Scaffold:** Vite + React-TS + Tailwind; bare globe that drags and spins.
- **Phase 1 — Data layer:** `api/eonet.ts`, `useEvents` (5-min refetch) + `useCategories`, typed, no `any`.
- **Phase 2 — Plot markers:** `lib/transform.ts` (coord swap, polygon fallback, last geometry, per-category color) → globe points.
- **Phase 3 — Interaction:** `onPointClick` → `EventPanel`; hover tooltip.
- **Phase 4 — Filters + stats:** `FilterBar` (category + status), URL search params, `StatsBar`, `Legend`.
- **Phase 5 — Polish:** loading spinner, error + retry, "updated N min ago", responsive, dark theme, atmosphere glow.

### Deferred to v2

Timeline scrubber; animate storm tracks along multi-point geometry; clustering when zoomed out; WMS layer imagery from EONET `/layers`.

---

## 6. Optional thin proxy (only if CORS/rate problems appear)

Don't build this unless §3's direct fetch fails. If needed, a tiny serverless function that forwards `/api/events` to NASA and re-emits CORS headers. Keeps the frontend identical — just point `BASE` in `src/api/eonet.ts` at `/api`.

---

## 7. Session discipline

1. **Plan Mode before any code.** State the plan, get it confirmed, then write.
2. **One feature per session.** Don't jump phases.
3. **CLAUDE.md is the single source of truth.** If reality diverges, update this file in the same session.
4. **QA gate between phases.** Show the check, don't just claim it.
5. Show reasoning, not just conclusions.

---

## 8. Quick reference — commands

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run typecheck
```

Smoke-test the API:

```bash
curl "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=5"
```

---

## 9. Build status & deviations (kept current per §7.3)

**Status:** Full MVP built (phases 0–5). Verified via `tsc --noEmit` (clean, no `any`), `npm run
build` (production build succeeds), and a unit check of `src/lib/transform.ts` covering the
coordinate swap, last-geometry selection, polygon fallback, filtering and stats.

> Note: NASA EONET (`eonet.gsfc.nasa.gov`) is unreachable from the CI/build container by network
> policy, so the **live marker data is confirmed in a browser** (`npm run dev`), not from CI.

**Intentional deviations from the original spec:**

1. **Fetch strategy.** Instead of a single `status=open` call, `useEvents` fetches open events
   **and** recently-closed events (last 120 days) in parallel and merges them
   (`Promise.all([...])`). This makes the status filter and the total/active/closed stats
   meaningful regardless of how the API behaves when `status` is omitted. The default UI view is
   still the active ("open") events, matching user story 1.
2. **Globe texture & controls.** The globe uses a night-lights ("Black Marble") look: a reliable
   2048px base (`earth-night.jpg` + `earth-topology.png` from a CDN) that always loads, then an
   **8K night map upgrade** (solarsystemscope) swapped in on top once it loads, with a silent
   fallback to the base if that host is unreachable/CORS-blocked. Render quality is boosted via
   device-pixel-ratio (capped 2×) and max anisotropy. **Auto-rotate is off** — the globe only
   moves when the user drags it.
3. **`postcss.config.js`** is committed explicitly (Tailwind v3) rather than relying on
   `tailwindcss init -p`.
4. **Legend is interactive** — clicking a category in the legend also sets the category filter
   (a small UX bonus beyond the spec).

**Portfolio integration:** LiveEarth is linked from the main portfolio (a project card in
`data/portfolio.ts`) and built + injected into the GitHub Pages output by the repo's
`.github/workflows/deploy.yml`, served at `/hussainkanaan/liveearth/`.
