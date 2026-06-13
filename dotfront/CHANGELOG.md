# Changelog

## M6 — AI Opponent

- **Strategist** (`ai/strategist.ts`): evaluates game state every ~1 s (same
  STAGGER tick as territory). Scores four intents:
  - **DEFEND** — player units within 220 px of an enemy city (highest urgency,
    scales with threat size)
  - **EXPAND** — neutral cities, prioritised by proximity to the enemy capital
  - **ATTACK** — player cities where enemy has ≥1.3× local force ratio or ≥12
    units nearby; capital assaults use a curved flanking path
  - **FALLBACK** — march idle units toward the nearest player city when no
    other target exists
  - **Economy**: queues light or heavy units at empty cities, maintaining a
    ~3:1 light:heavy ratio, keeping a 150-money reserve
- **Commander** (`ai/commander.ts`): assigns nearest idle enemy units to the
  top-4 priority targets; defend orders override idle check. Capital assaults
  get a perpendicular-offset midpoint (encircle flank) using `state.rng`.
- **Win conditions** (`sim/win.ts`): capture the enemy capital AND own ≥80% of
  all cities → win. After 15 min (MATCH_DURATION=900 s), most cities wins;
  equal = draw.
- **Match timer**: `state.matchTime` accumulated each tick; displayed as MM:SS
  in the HUD.
- **End screen**: VICTORY / DEFEAT / DRAW overlay with final stats; "Play
  Again" generates a fresh random seed.
- **Sim guards**: `stepSimulation` and `stepAI` skip when `matchPhase !==
  'playing'` — final state is held for the end screen.
- **Tests** (8 new — `sim/win.test.ts`): mid-game null, player/enemy capital +
  80% win, capital-only not enough, timer player win, timer enemy win, timer
  draw, timer not yet expired.
- **Bundle**: 13.65 KB gzipped (budget 150 KB). ✓

## M5 — Territory & Encirclement

- **Territory flood fill** (`sim/territory.ts`): every 20 ticks (≈1 s), a
  64 px coarse grid is built. Cells within 80 px of any alive unit or city
  (that aren't mountain) become anchors; BFS finds connected components per
  player — these are their **regions**.
- **Pocket detection**: a region with no friendly city gets `isPocket = true`
  and `supplyCapacity = 0`. Units in pockets starve immediately at
  STARVATION_DPS regardless of the owner's global city count.
- **Per-region supply** (`sim/economy.ts`): when territory data is present,
  starvation is computed per connected region instead of globally. Units
  outside any friendly territory also starve. Falls back to global supply
  (M4 logic) on the first tick before territory is computed.
- **Territory render** (`render/renderer.ts`): faint 8%-opacity coloured
  fills over owned cells, plus a 1.5px front-line border wherever ownership
  changes between adjacent cells.
- **Debug overlay** (`D` key): each connected component tinted with a
  distinct golden-angle hue; pocket regions are desaturated.
- **HUD**: pocket count warning (⚠ N pocket(s)) shown when player has
  isolated regions.
- **Tests** (9 new): player/enemy cell ownership, contested cells, dead units
  excluded, city-only anchors, city-connected non-pocket vs isolated pocket,
  dual-city supply capacity, mountain column splits regions.
- **Bundle**: 12.28 KB gzipped (budget 150 KB). ✓

## M4 — Economy, Production & Capture

- **City income** (`sim/economy.ts`): each owned city generates +10 money/s;
  money floors at 0 but never blocks the sim.
- **Supply system** (§5.3): each owned city provides 5 supply weight. Field
  units (outside friendly city radii) consume supply weight (light 1, heavy 2).
  Over-cap units take 2 HP/s starvation and flicker visually; the farthest
  units from friendly cities starve first.
- **Money upkeep**: field units also drain money (light 1/s, heavy 2/s) in
  addition to supply weight — keeps the economy under pressure late game.
- **City capture**: a unit holding an enemy/neutral city radius uncontested for
  5 s converts it; capture resets instantly if contested. Progress ring drawn
  in the captor's colour around the city border.
- **Production** (§5.3): click an owned city → DOM menu with Light (200) /
  Heavy (400) cost buttons (greyed out when funds are insufficient). Units
  spawn at the city edge after 2 s using the seeded RNG; optional rally-point
  field on `ProductionJob` is wired through for future AI use.
- **Render juice** (§7): capture progress arc, production bar below city,
  starving units flicker at a faster frequency than routing units.
- **HUD**: money, supply field/cap, and city count shown each frame.
- **Tests** (15 new): income scaling, neutral-city no-income, `computeSupply`
  field-weight + city-shelter + capacity, starvation on/off, unit-in-city
  immunity, capture progress + contested reset, multi-tick accumulation,
  production spawn + rally point + neutral-city block.
- **Bundle**: 10.99 KB gzipped (budget 150 KB). ✓

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
