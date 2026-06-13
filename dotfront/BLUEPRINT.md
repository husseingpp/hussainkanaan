# DOTFRONT.io — Game Blueprint
### A minimalist real-time strategy web game (War of Dots mechanics × .io instant-play DNA)
**Author:** Hussein × Claude · **Date:** June 2026 · **Status:** Blueprint v1.0 — ready for Claude Code kickoff
---
## 1. Concept
DOTFRONT is a browser-based real-time strategy game where you command armies of dots against an enemy faction. No tech trees, no build menus, no resource micromanagement screens. The entire game is: dots, cities, terrain, and your decisions about where to send them.
**Reference games and what we take from each:**
| Source | What we borrow |
|---|---|
| War of Dots (Steam) | Core mechanics: light/heavy units, city economy + supply caps, morale, terrain effects, encirclement, lasso selection, capital + city-control win condition |
| .io games (agar.io, paper.io, diep.io) | Instant play (no install, no account for MVP), one-screen minimal UI, short 5–10 min matches, flat bold visual style, "one more game" loop |
**One-sentence pitch:** *Lasso your dots, draw their path, cut off the enemy's cities, and watch their army starve.*
**Target platform:** Desktop browser first (mouse-driven lasso selection is core). Touch support in a later phase.
---
## 2. Scope & Phasing
Build in three phases. **Do not start Phase 2 until Phase 1 ships and is playable end-to-end.**
### Phase 1 — MVP: Single-player vs AI (the real game)
- One procedurally-seeded map (plains, forest, hills, water, mountains)
- Player (blue) vs 1 AI opponent (red)
- Light + heavy units, cities, capitals, supply, morale, terrain effects
- Lasso selection + path drawing
- Encirclement / pocket economies
- Win/lose screen, restart, match timer
- Deployed on Vercel, playable by anyone with a link
### Phase 2 — Polish & retention
- 3 difficulty levels for the AI
- Map variety (3–5 handcrafted maps + seeded random)
- Sound (minimal: combat ticks, capture chime, ambient)
- Match replay (record orders + seed, replay deterministically)
- Local stats (wins/losses, fastest victory) via localStorage
- Touch controls for mobile/tablet
### Phase 3 — Multiplayer (separate project decision)
- 1v1 real-time over WebSocket with an authoritative server (Colyseus on a small VPS, or Supabase Realtime for lobby + a dedicated game server)
- Lockstep or server-authoritative simulation — decide later
- **Explicitly out of scope for now.** The architecture below keeps the simulation deterministic and decoupled from rendering so multiplayer is *possible* later without a rewrite, but nothing in Phase 1–2 should be built "for multiplayer."
---
## 3. Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Type safety across a simulation with many interacting systems |
| Build tool | Vite | Instant dev server, trivial Vercel deploy |
| Rendering | **HTML5 Canvas 2D** (raw, no engine) | Dots, lines, and polygons — Canvas 2D handles 500+ dots at 60fps easily. PixiJS (WebGL) is the escalation path if profiling demands it; don't start there |
| UI layer | Plain DOM + a thin layer of vanilla TS (or Preact if menus grow) | The in-game UI is ~5 elements: money, supply, timer, city count, pause. No React for the game itself |
| State | Plain TS objects in a single `GameState` — no state library | The simulation IS the state. Libraries add overhead and non-determinism risk |
| Audio | Howler.js (Phase 2) | Simple, reliable web audio |
| Hosting | Vercel (static) | Free, instant, matches Hussein's existing workflow |
| Testing | Vitest | Unit tests for combat math, supply, encirclement — the systems where bugs are invisible until they ruin a match |
**Key architectural rule:** the simulation must be **deterministic and renderer-independent**. Fixed timestep, seeded RNG, no `Math.random()` inside simulation code, no reading wall-clock time in game logic. This makes replays free in Phase 2 and multiplayer feasible in Phase 3.
---
## 4. Architecture
```
src/
├── core/
│   ├── loop.ts            # Fixed-timestep loop: sim at 20 ticks/sec, render at 60fps w/ interpolation
│   ├── rng.ts             # Seeded PRNG (mulberry32) — ONLY source of randomness in sim
│   └── state.ts           # GameState type: units[], cities[], terrain grid, players, tick counter
├── sim/                   # Pure logic. No canvas, no DOM, no Date.now(). Fully testable.
│   ├── movement.ts        # Path following + boids-style separation/cohesion
│   ├── combat.ts          # Damage resolution, morale, healing
│   ├── economy.ts         # City income, upkeep, supply caps, starvation
│   ├── territory.ts       # Region/pocket detection (flood fill), city capture
│   ├── production.ts      # Unit spawning at cities
│   ├── terrain.ts         # Terrain grid, movement/damage modifiers, ship conversion
│   └── win.ts             # Victory condition checks
├── ai/
│   ├── strategist.ts      # High-level: expand / attack / defend / encircle decisions (~1/sec)
│   └── commander.ts       # Converts strategy into unit orders (paths)
├── input/
│   ├── lasso.ts           # Freehand loop selection (point-in-polygon)
│   └── orders.ts          # Path drawing, stop (S), clear orders (C)
├── render/
│   ├── renderer.ts        # Canvas draw loop, camera (pan/zoom), interpolation
│   ├── terrain-layer.ts   # Pre-rendered terrain to offscreen canvas (draw once)
│   └── effects.ts         # Combat shake, damage flashes, capture pulses
├── ui/
│   └── hud.ts             # Money, supply, city count, timer, end screen
└── main.ts
```
**Game loop contract:**
- Simulation: fixed 50ms ticks (20 TPS). All gameplay math happens here.
- Render: `requestAnimationFrame`, interpolating unit positions between the last two sim ticks for smooth 60fps motion.
- Spatial hash grid (cell size ≈ 2× unit interaction radius) rebuilt each tick — used by combat targeting, separation steering, and healing checks. This is THE performance lever; never do O(n²) all-pairs checks.
---
## 5. Core Mechanics Specification
All numbers below are starting values for tuning, not gospel. Put them all in one `config.ts` so balancing is a one-file job.
### 5.1 Units
| | Light | Heavy |
|---|---|---|
| Cost | 200 | 400 |
| HP | 100 | 250 |
| Damage/sec | 10 | 25 |
| Speed | 60 px/s | 35 px/s |
| Supply weight | 1 | 2 |
| Visual | Small filled dot (r=4) | Larger dot with inner ring (r=6) |
| Terrain | Mild penalties | Heavy penalties in forest/hills (see 5.4) |
- Units are individual entities (not blobs) — the "many dots on screen" feel comes from armies of 30–100+ individual dots.
- Movement: follow assigned path waypoints + boids separation (don't overlap friendlies) + slight cohesion within a selection group. No full A* pathfinding for MVP — units path directly along drawn lines; mountains block and units slide along them. (A* on the terrain grid is a Phase 2 upgrade if it feels bad.)
- Engagement: a unit auto-attacks the nearest enemy within range (≈ 14px). Attacker/defender status is determined by who is moving into contact (units with active move orders into enemy proximity = attacking).
### 5.2 Health, Healing & Morale
- HP bar (green → red) shown only when damaged.
- **Attacking costs more:** units flagged as attacking take +30% incoming damage and lose morale ~2× faster. This single rule creates the defend-bait-counterattack meta.
- Morale: 0–100. Drains while in combat (faster when attacking), regenerates when out of combat. At morale < 30, damage output scales down to 50%. At morale 0, the unit retreats toward the nearest friendly city (uncontrollable for 3s).
- Healing: +2 HP/s when no enemy within 150px; **+4 HP/s inside a friendly city radius**.
- Combat feedback: units shake while fighting; brief white flash on hit.
### 5.3 Cities, Economy & Supply
- Cities are circles on the map; capitals get a star marker.
- Income: each owned city generates +10 money/sec.
- Production: click an owned city → radial menu (Light 200 / Heavy 400). Units spawn at city edge over 2s. Optional rally point.
- **Supply: each city supports 5 supply weight.** Units inside a friendly city radius cost no upkeep. Units in the field cost upkeep (light 1/s, heavy 2/s money). If total supply weight exceeds total city supply in a connected region, over-cap units lose 2 HP/s (starvation) — oldest/farthest units first.
- Capture: an enemy/neutral city with no defenders converts to your side after a friendly unit holds its radius uncontested for 5s. Capture progress ring shown.
### 5.4 Terrain (grid-based, ~32px cells)
| Terrain | Light units | Heavy units | Notes |
|---|---|---|---|
| Plains | normal | normal | Baseline |
| Forest | normal | −50% speed, −60% damage | Light-unit ambush country |
| Hills | normal | −50% speed, −60% damage | Same as forest, different color |
| Water | −50% speed, −40% damage, 1 HP/s drain | same | Unit converts to **ship** after 5s in water (faster on water, very weak) |
| Mountain | impassable | impassable | Hard walls; shapes the map's chokepoints |
| Sand | −30% speed | normal | The one terrain that punishes light units |
| Snow/Mud | −25% damage | −25% damage | Phase 2 — skip for MVP |
| City/Bridge | normal, safe | normal, safe | Healing + no upkeep |
MVP terrain set: **plains, forest, hills, water, mountain.** Map generation: simplex-noise elevation + moisture → terrain classification, then place 10–16 cities with spacing constraints and one capital per player at opposite ends. Validate with a connectivity check (both capitals reachable over land).
### 5.5 Selection & Orders (the core feel — get this perfect)
- **Lasso select:** click-drag draws a freehand loop; on release, every friendly unit inside the polygon is selected (ray-casting point-in-polygon). Selected units get a subtle outline.
- **Path orders:** with units selected, click-drag draws a path; units follow the drawn curve (resampled to waypoints every ~20px). This enables flanking hooks and encirclement sweeps — it's the signature interaction.
- Hotkeys: **S** = stop selected, **C** = clear orders, **Esc** = deselect, **Space** = pause (single-player luxury).
- Camera: edge-pan + WASD/arrows + scroll zoom (0.5×–2×).
### 5.6 Encirclement & Pockets (the strategic depth)
Every ~1s, run a flood fill over the terrain grid using each player's **unit positions + city radii as territory anchors** with a connection radius (~80px between friendly anchors = connected). The result: connected regions per player.
- A region containing units but cut off from any region with friendly cities = a **pocket**: those units immediately count against zero supply → starvation drain.
- An enemy city pocketed away from its capital region still produces for them, but units it supports can't be reinforced through your lines.
- Visual: draw a faint tinted hull/border around each connected territory so players can *see* the front line and pockets — this is also just beautiful and very ".io".
This system is the hardest to get right. Build it behind a debug overlay (toggle with **D**) that renders regions in distinct colors from day one.
### 5.7 Win/Lose
- **Win:** capture the enemy capital **AND** control ≥ 80% of all cities. (Capital-only capture flips it to a regular city for them — they fight on from remaining cities. This prevents cheesy capital rushes.)
- **Lose:** mirror condition.
- Match timer; if 15 min elapse, most cities wins.
---
## 6. AI Opponent (Phase 1, single difficulty)
Two-layer AI, evaluated cheaply:
**Strategist (runs 1×/sec):** scores high-level intents from game state:
- `EXPAND` — neutral cities exist and are cheaply reachable → send small light squads
- `DEFEND` — friendly city threatened (enemy mass within radius) → pull nearby units back
- `ATTACK` — local force advantage ≥ 1.5× at a target city → commit
- `ENCIRCLE` — enemy mass far from their cities → curve a flanking path behind them
- Economy: keep producing while money > reserve; light:heavy ratio ~3:1; respect supply cap minus a small buffer
**Commander:** turns the chosen intent into concrete lasso-equivalent group orders with simple curved paths (offset midpoints for flanks).
Difficulty knobs for Phase 2: decision interval, force-advantage threshold, supply discipline, reaction time to threats. **No cheating AI** (no free money, no map hacks beyond what's visible — there's no fog of war in MVP anyway, matching War of Dots' full-visibility design).
---
## 7. Visual Design
- **Style:** flat, minimal, high-contrast. Off-white paper background (#F2EFE9), blue player (#2E6CF6), red enemy (#E5484D), neutral gray cities (#9B9B9B), terrain in soft muted tones (forest #C8D8C0, hills #DCD3BE, water #BFD7E8, mountains #B0AAA2 with simple ridge marks).
- Territory tint at ~8% opacity with a 1.5px front-line border.
- Typography: one geometric sans (e.g., Inter or Space Grotesk), used sparingly — HUD numbers only.
- Juice budget (cheap, high-impact): combat shake, capture progress ring, city-capture pulse, starvation units fading/flickering, soft trail on moving groups.
- No sprites, no images. Everything is `arc()`, `path()`, and polygons → tiny bundle, crisp at any zoom.
---
## 8. Performance Targets & Tactics
| Target | Number |
|---|---|
| Units on screen | 300 (stretch: 600) |
| Sim tick | ≤ 8ms at 300 units |
| Render frame | 60fps on a mid-range laptop |
| Bundle | < 150KB gzipped |
Tactics: spatial hash for all proximity queries; terrain pre-rendered once to an offscreen canvas; typed arrays or flat object pools for units if GC pressure shows up (profile first); territory flood fill on a coarse grid (64px cells), staggered (not every tick); zero allocations inside the hot sim loop where practical.
---
## 9. Build Roadmap (Claude Code milestones with QA gates)
Each milestone ends with a **mandatory QA gate** — play it in the browser and verify the checklist before moving on. Commit per milestone.
**M0 — Skeleton (½ day)**
Vite + TS strict + Vitest + ESLint. Fixed-timestep loop with interpolated render. 50 inert dots drifting with separation steering. Camera pan/zoom.
✅ Gate: 60fps, dots never overlap, pan/zoom smooth.
**M1 — Selection & Orders (1 day)**
Lasso select, path drawing, path following, S/C hotkeys.
✅ Gate: lasso 30 dots, draw a hook-shaped path, they follow the curve in formation. This must *feel* good — iterate here before anything else.
**M2 — Terrain & Map Gen (1 day)**
Noise-based map, 5 MVP terrains, movement modifiers, mountain blocking, debug terrain-grid overlay. City placement + capitals + connectivity validation.
✅ Gate: regenerate 10 seeds — all valid, light units visibly outrun heavies in forest.
**M3 — Combat & Morale (1–1.5 days)**
Engagement, damage, attacker penalty, morale drain/rout, healing, shake/flash effects. Unit tests on combat math.
✅ Gate: 30 light vs 12 heavy on plains ≈ even fight; same fight in forest = lights win clearly; attacking into a defended position loses against equal numbers.
**M4 — Economy, Production & Capture (1 day)**
Income, upkeep, supply caps, starvation, city production menu, capture mechanic. Unit tests on supply math.
✅ Gate: over-produce on purpose → field units starve; capture a neutral city → supply cap visibly rises.
**M5 — Territory & Encirclement (1–1.5 days, hardest)**
Flood-fill regions, pocket detection, pocket starvation, territory tint + front-line render, debug region overlay.
✅ Gate: manually encircle a red squad → their HP drains; the pocket is visibly outlined.
**M6 — AI Opponent (1.5 days)**
Strategist + commander, full match loop, win/lose screen, restart, timer.
✅ Gate: AI beats a passive player; a decent player can beat the AI; matches end in 5–12 min.
**M7 — Ship it (½ day)**
HUD polish, start screen with seed input, favicon/OG tags, Vercel deploy, README.
✅ Gate: friend plays it cold from a link and understands it within 60 seconds without explanation.
**Total: ~8 working days of focused Claude Code sessions.**
---
## 10. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Movement feels mushy (the #1 way this genre dies) | M1 gate is feel-based; tune separation/arrival before building anything on top |
| Encirclement logic buggy/opaque | Debug overlay from day one; coarse grid; unit tests on synthetic layouts |
| Balance is off (heavies useless or unstoppable) | All constants in `config.ts`; scripted skirmish scenarios as repeatable tests |
| Scope creep toward multiplayer | Phase 3 is explicitly frozen; determinism is the only concession we make now |
| Performance collapse at 300+ units | Spatial hash from M0; profile at M3 with 400 units before adding systems |
---
## 11. Claude Code Kickoff Prompt
Copy everything below into Claude Code in the empty project directory (and place this blueprint file in the repo root as `BLUEPRINT.md` first):
---
> You are building **DOTFRONT.io**, a minimalist real-time strategy web game. The complete specification is in `BLUEPRINT.md` in this repo — read it fully before writing any code. Treat it as the source of truth for mechanics, numbers, architecture, and milestones.
>
> **Working rules:**
> 1. Work milestone by milestone (M0 → M7 in §9). Never start a milestone before the previous one's QA gate checklist is implemented and you've told me to verify it in the browser. After each milestone, stop and wait for my confirmation.
> 2. Stack: Vite + TypeScript (strict mode) + Canvas 2D + Vitest. No game engine, no React for the game canvas, no state libraries.
> 3. The simulation (`src/sim/`) must be pure and deterministic: fixed 50ms timestep, seeded RNG only (mulberry32 in `src/core/rng.ts`), no `Math.random()`, no `Date.now()`, no DOM/canvas access inside `src/sim/` or `src/ai/`. Rendering interpolates between sim ticks.
> 4. All gameplay constants (costs, HP, damage, speeds, terrain modifiers, supply numbers, AI thresholds) live in a single `src/config.ts`.
> 5. Use a spatial hash grid for every proximity query. No O(n²) loops over units.
> 6. Write Vitest unit tests for: combat damage math (incl. attacker penalty and morale scaling), supply/starvation accounting, point-in-polygon lasso selection, and territory flood-fill on small synthetic grids.
> 7. Build debug overlays early (toggle keys): **D** = territory regions, **T** = terrain grid, **H** = spatial hash occupancy.
> 8. Performance budget: 300 units, sim tick ≤ 8ms, 60fps render. Profile at M3 with 400 units and report numbers.
> 9. Visual style per §7 of the blueprint: flat colors on off-white, no images/sprites, everything drawn procedurally.
> 10. Git: one commit per milestone minimum, conventional commit messages, maintain a short `CHANGELOG.md`.
>
> Start now with **M0**: scaffold the project, implement the fixed-timestep loop with render interpolation, seeded RNG, spatial hash, camera pan/zoom, and 50 drifting dots with separation steering. Then stop and give me the QA checklist to verify.
---
*End of blueprint. Tuning numbers in §5 are starting points — expect 2–3 balance passes after M6.*
