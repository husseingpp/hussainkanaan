# Changelog

## M1 — Selection & Orders

- **Lasso select:** freehand left-drag draws a polygon; release selects all
  friendly units inside (ray-casting `pointInPolygon`).
- **Path orders:** with units selected, left-drag draws a freehand stroke that
  is resampled into evenly-spaced waypoints (`resamplePath`, spacing 20 px)
  and assigned to every selected unit simultaneously.
- **Path following:** units steer smoothly toward each waypoint in turn,
  decelerate near the final one, then stop. Boids separation keeps them spread
  out in loose formation without single-filing.
- **Hotkeys:** `S` / `C` = stop + clear orders, `Esc` = deselect all,
  `Space` = pause (sim only), `H` = hash overlay.
- **Render overlays:** dashed lasso preview, live path stroke with arrow tip,
  confirmed group-path trail, selection ring on each selected unit.
- **Tests:** `pointInPolygon` (5 cases incl. concave L-shape) +
  `resamplePath` (6 cases incl. diagonal, oversize spacing, multi-segment).


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
