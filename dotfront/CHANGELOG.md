# Changelog

## M3 — Combat & Morale

- **Combat** (`sim/combat.ts`): units auto-attack the nearest enemy within
  range via the spatial hash; damage scales by morale and terrain (heavies
  −60% in forest/hills, −40% in water).
- **Attacker penalty** (§5.2): engaging while under a move order flags a unit
  "attacking" — it takes +30% incoming damage and loses morale 2× faster,
  creating the defend-bait-counterattack meta.
- **Morale**: drains in combat, regenerates out; below 30 damage halves; at 0
  the unit routs (uncontrollable, flees to the nearest friendly city for 3s).
- **Healing**: +2 HP/s in the field when no enemy within 150px, +4 HP/s inside
  a friendly city radius; water saps 1 HP/s.
- **Enemy army** now spawns at the red capital, so there's something to fight.
- **Tick orchestration** (`sim/simulate.ts`): one shared spatial-hash rebuild,
  combat → remove dead → movement, in a single deterministic pass.
- **Render juice** (§7): HP bars (green→red, only when damaged), white hit-flash,
  combat shake, routing units flicker.
- **Input**: routing/dead units can't be ordered.
- **Tests**: damage math (morale, terrain, attacker penalty) + scripted
  skirmishes — 30 light vs 12 heavy is even on plains, a lopsided light win in
  forest, and attackers take more net damage than equal defenders.
- **Perf** (§8): full sim tick **~3.0ms at 400 units** all engaged (budget 8ms).

## M2 — Terrain & Map Generation

- **Seeded noise** (`sim/noise.ts`): Perlin + fBm with a permutation table
  shuffled by the seeded RNG — no external dependency, deterministic.
- **Terrain grid** (`sim/terrain.ts`): 5 MVP types (plains/forest/hills/water/
  mountain) as a `Uint8Array`, with per-type/per-kind speed & damage modifier
  tables and a land-connectivity BFS.
- **Map generation** (`sim/mapgen.ts`): fBm elevation + moisture → terrain
  classification; capitals placed at opposite edge bands; 8–12 neutral cities
  by spacing-constrained rejection sampling; validated by capital↔capital land
  connectivity with deterministic re-rolls on failure. City footprints are
  stamped to plains (safe/passable).
- **Terrain-aware movement**: heavy units are halved in forest/hills, both
  slowed in water; mountains are walls — units slide along them (axis-separated
  collision).
- **Units now have a kind** (light/heavy); the start army (36 light + 12 heavy)
  spawns around the player capital.
- **Render**: terrain pre-rendered once to an offscreen world-sized canvas;
  cities drawn with capital stars; heavy units drawn with an inner ring;
  `T` toggles the terrain-grid debug overlay.
- **Tests**: terrain modifiers + flood-fill connectivity (synthetic walls);
  `generateMap` validated for 10 seeds (all connected, spaced, capitals on
  land) plus determinism.

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
