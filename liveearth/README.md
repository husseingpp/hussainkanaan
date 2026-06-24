# 🌍 LiveEarth — Live Natural Events Globe

An interactive 3D globe that plots **current natural events happening around the world** —
wildfires, volcanoes, severe storms, floods and more — at their real coordinates, pulled live
from NASA's [EONET v3 API](https://eonet.gsfc.nasa.gov/docs/v3). Click a marker for details,
filter by category and status, and the data auto-refreshes so the globe stays "live."

No accounts, no backend, no API key — the app is read-only against NASA's public API.

## Features

- 🌐 Draggable 3D **relief globe** (react-globe.gl / three.js) — a **cyberpunk neon planet**: real
  terrain displacement (mountains/valleys) with a cyan→magenta elevation glow (emissive), no photo
  imagery, magenta atmosphere — matched by a neon dark-glass UI
- 🔴 Live event markers, colour-coded per category, plotted at real `{lat, lng}`
- 🔎 **Multi-select** category filter (toggle individual categories off while keeping the rest) +
  **status** (all / active / closed); reflected in the URL so views are shareable
- 🪟 Click a marker → detail panel with title, category, most-recent date, coordinates and
  source links
- 📊 Live stats (total / active / closed) + an "updated N min ago" indicator
- ♻️ Auto-refresh every 5 minutes (TanStack Query)
- 🌙 Dark theme, responsive, touch-friendly

## Tech stack

Vite · React 18 · TypeScript · react-globe.gl (three.js) · TanStack Query · Tailwind CSS v3

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm run typecheck
```

## How it works

- `src/api/eonet.ts` — typed `fetch` wrappers for `/events` and `/categories`.
- `src/hooks/useEvents.ts` — fetches open + recently-closed events and merges them, refetching
  every 5 min. `useCategories.ts` powers the filter dropdown.
- `src/lib/transform.ts` — turns EONET events into globe markers. **EONET coordinates are
  `[lng, lat]`**; this is where they're swapped to `{ lat, lng }`. It also uses the most-recent
  geometry entry and falls back to a polygon's first vertex so every event plots.
- `src/components/` — `Globe`, `FilterBar`, `EventPanel`, `StatsBar`, `Legend`.

## Project structure

```
liveearth/
├── index.html
├── src/
│   ├── main.tsx · App.tsx
│   ├── api/eonet.ts
│   ├── hooks/{useEvents,useCategories}.ts
│   ├── lib/transform.ts
│   ├── types/eonet.ts
│   ├── components/{Globe,FilterBar,EventPanel,StatsBar,Legend}.tsx
│   └── styles/index.css
└── CLAUDE.md   ← project spec / source of truth
```

Built as part of [Hussein Kanaan's portfolio](https://github.com/husseingpp/hussainkanaan).
