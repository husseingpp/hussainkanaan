# DOTFRONT.io

A minimalist real-time strategy web game — lasso your dots, draw their path,
cut off the enemy's cities, and watch their army starve. War of Dots mechanics
with .io instant-play DNA. See [`BLUEPRINT.md`](./BLUEPRINT.md) for the full
spec, mechanics, and milestone roadmap.

**▶ Play:** https://husseingpp.github.io/hussainkanaan/dotfront/

**Stack:** Vite + TypeScript (strict) + Canvas 2D + Vitest. No game engine, no
React for the canvas, no state libraries. The simulation is deterministic and
renderer-independent (fixed 50ms timestep, seeded RNG) so replays and
multiplayer stay feasible later.

## Status

**Shipped (M0–M7) — playable single-player vs AI.** A full match loop: lasso
selection and freehand path orders, procedurally generated terrain maps,
auto-attack combat with morale/rout and healing, a city economy with
production, supply caps and starvation, territory flood-fill with encirclement
pockets, a two-layer AI opponent (strategist + commander), and win/lose/draw
with a 15-minute match timer. Start screen with a seed box, clean HUD, and an
end screen with one-click replay. Sim tick profiles at ~3ms with 400 units
engaged (budget 8ms); bundle is ~14KB gzipped (budget 150KB).

## How to play (60 seconds)

You are **blue**. Beat the **red** AI by taking its capital and most of the
cities — or by surrounding its army so it starves.

- **Select** — drag a loop (lasso) around your blue dots.
- **Move** — click to send the selection there; drag a curved path from a
  selection to flank or sweep behind the enemy.
- **Build** — click one of your cities to produce Light (200) or Heavy (400)
  units. Cities earn +10 money/s.
- **Supply** — each city supports 5 supply weight. Units in the field beyond
  your cap (or cut off from your cities) **starve**. Encircle the enemy to cut
  *their* supply.
- **Win** — capture the enemy capital **and** own ≥80% of all cities.

## Controls

- **Left-drag** (empty space) — lasso-select your units
- **Click** — quick move order · **left-drag with a selection** — draw a path
- **Click your city** — open the production menu
- **S** stop · **C** clear orders · **Esc** deselect · **Space** pause
- **WASD / arrow keys** or **screen edges** — pan · **mouse wheel** — zoom
- **T** terrain grid · **H** spatial hash · **D** territory regions ·
  **` (backtick)** debug stats

Append `?seed=<value>` to the URL (or type a seed on the start screen) to
reproduce a specific map; the same seed always yields the same match.

## Develop

```bash
cd dotfront
npm install
npm run dev      # Vite dev server
npm test         # Vitest unit tests (81 across sim/combat/economy/territory/win)
npm run build    # tsc --noEmit + vite build
npm run lint     # ESLint (incl. sim determinism guardrails)
```

## Architecture

The simulation (`src/sim/`) and core state (`src/core/state.ts`) are pure: no
DOM, no canvas, no `Date.now()`, no `Math.random()` — randomness comes only from
the seeded `mulberry32` PRNG in `src/core/rng.ts`. An ESLint rule enforces this.
The renderer reads state and interpolates positions between the last two sim
ticks. All proximity queries go through the spatial hash in
`src/core/spatial-hash.ts`. The AI (`src/ai/`) is likewise pure and seeded.
Every tunable constant lives in `src/config.ts`.

A single fixed tick runs combat → remove dead → movement → economy, and every
~1s also rebuilds territory, runs the AI, and checks the win condition. See
[`CHANGELOG.md`](./CHANGELOG.md) for the per-milestone build log.

## Deploy

Built and published to GitHub Pages by the repo's
[`deploy.yml`](../.github/workflows/deploy.yml) workflow, which runs
`npm run build` in `dotfront/` and copies `dist/` to `out/dotfront/`. Vite's
`base: './'` keeps asset paths relative so the game works under the
`/hussainkanaan/dotfront/` subpath.
