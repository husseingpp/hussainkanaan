# Changelog

## M0 — Skeleton

- Scaffolded Vite + TypeScript (strict) + Vitest + ESLint under `dotfront/`.
- Fixed-timestep game loop (20 TPS sim) with render interpolation (`alpha`)
  and a tick-cap accumulator that won't death-spiral on a stalled tab.
- Seeded `mulberry32` PRNG — the sim's only randomness source.
- Spatial hash grid with pooled cell arrays; `queryRadius` powers separation
  now and combat/healing/capture later. No O(n²) over units.
- Pure `sim/movement.ts`: boids separation so dots never overlap, drift
  integration, soft world-bound bounces.
- Camera: WASD/arrows + edge pan, cursor-anchored wheel zoom (0.5×–2×).
- Canvas 2D renderer (DPR-aware) with an `H` spatial-hash occupancy overlay.
- ESLint guardrail forbidding `Math.random`/`Date.now`/DOM in sim code.
- Unit tests: RNG determinism, spatial-hash queries, loop accumulator timing.
