# DOTFRONT.io

A minimalist real-time strategy web game — lasso your dots, draw their path,
cut off the enemy's cities, and watch their army starve. War of Dots mechanics
with .io instant-play DNA. See [`BLUEPRINT.md`](./BLUEPRINT.md) for the full
spec, mechanics, and milestone roadmap.

**Stack:** Vite + TypeScript (strict) + Canvas 2D + Vitest. No game engine, no
React for the canvas, no state libraries. The simulation is deterministic and
renderer-independent (fixed 50ms timestep, seeded RNG) so replays and
multiplayer stay feasible later.

## Status

**M0 — Skeleton.** Fixed-timestep loop with interpolated render, seeded RNG,
spatial hash, camera pan/zoom, and 50 drifting dots with separation steering.

## Develop

```bash
cd dotfront
npm install
npm run dev      # Vite dev server
npm test         # Vitest unit tests
npm run build    # tsc --noEmit + vite build
npm run lint     # ESLint (incl. sim determinism guardrails)
```

## Controls (M0)

- **WASD / arrow keys** or **screen edges** — pan the camera
- **Mouse wheel** — zoom (0.5×–2×, anchored on the cursor)
- **H** — toggle the spatial-hash occupancy debug overlay

Append `?seed=<value>` to the URL to reproduce a specific drift pattern; the
same seed always yields the same simulation.

## Architecture

The simulation (`src/sim/`) and core state (`src/core/state.ts`) are pure: no
DOM, no canvas, no `Date.now()`, no `Math.random()` — randomness comes only from
the seeded `mulberry32` PRNG in `src/core/rng.ts`. An ESLint rule enforces this.
The renderer reads state and interpolates positions between the last two sim
ticks. All proximity queries go through the spatial hash in
`src/core/spatial-hash.ts`. Every tunable constant lives in `src/config.ts`.
