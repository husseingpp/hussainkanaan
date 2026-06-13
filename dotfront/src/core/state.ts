// GameState: plain TS objects, no state library (BLUEPRINT.md §3). The sim
// mutates this in place each tick; the renderer only reads it.

import { CONFIG } from '../config';
import { generateMap } from '../sim/mapgen';
import { UNIT_TYPES, type UnitKind } from '../sim/unit-types';
import { isPassable, type TerrainGrid } from '../sim/terrain';
import { mulberry32, randRange, type Rng } from './rng';

export type { UnitKind } from '../sim/unit-types';

export interface Vec2 {
  x: number;
  y: number;
}

export type Owner = 'player' | 'enemy' | 'neutral';
export type MatchPhase = 'playing' | 'won' | 'lost' | 'draw';
export type FormationType = 'line' | 'column' | 'wedge' | 'box';

export interface Squad {
  id: number;           // 1–9
  owner: Owner;
  formation: FormationType;
}

export interface Tracer {
  from: Vec2;
  to: Vec2;
  ageMs: number;        // increased by renderer each frame; removed when >= TRACER_DURATION_MS
}

export interface Unit {
  id: number;
  owner: Owner;
  kind: UnitKind;
  pos: Vec2;
  /** Position at the previous sim tick — the renderer lerps prevPos→pos. */
  prevPos: Vec2;
  vel: Vec2;
  radius: number;
  /** Ordered path waypoints (world coords). Empty = stopped/idle. */
  waypoints: Vec2[];
  waypointIdx: number;
  stopped: boolean;
  selected: boolean;

  // ── Squad / formation (M8) ──
  squadId: number | null;
  squadSlot: number;

  // ── Combat state (M3) ──
  hp: number;
  maxHp: number;
  /** Base damage per second at optimal range on plains at full morale. */
  dps: number;
  morale: number;
  /** True this tick if an enemy is within attack range. */
  inCombat: boolean;
  /** True this tick if engaging while under a move order (attacker penalty). */
  attacking: boolean;
  /** Seconds of forced rout remaining (uncontrollable, fleeing). >0 = routing. */
  routTimer: number;
  /** Damage accumulated this tick, applied at end of the combat step. */
  dmgTaken: number;
  /** White hit-flash timer, seconds (visual). */
  flashTimer: number;
  /** Current attack target this tick (transient; recomputed each tick). */
  target: Unit | null;
  /** True this tick if the unit is over the supply cap and losing HP. */
  starving: boolean;
}

export interface ProductionJob {
  kind: UnitKind;
  /** Seconds elapsed toward the unit's spawnTime. */
  progress: number;
  /** Optional point units march to after spawning. */
  rallyPoint: { x: number; y: number } | null;
}

export interface City {
  id: number;
  owner: Owner;
  pos: Vec2;
  radius: number;
  isCapital: boolean;
  // ── Economy (M4) ──
  /** Seconds accumulated by the current captor (0 if not being captured). */
  captureProgress: number;
  /** Who is currently contesting this city (null if uncontested or idle). */
  captureBy: Owner | null;
  /** Units queued for production; first entry is currently being produced. */
  productionQueue: ProductionJob[];
}

// ── Territory (M5) ───────────────────────────────────────────────────────────

export interface TerritoryRegion {
  id: number;
  owner: 'player' | 'enemy';
  /** True when the region has no friendly city (pocket → zero supply). */
  isPocket: boolean;
  /** Total supply weight capacity from cities inside this region. */
  supplyCapacity: number;
}

export interface TerritoryData {
  cols: number;
  rows: number;
  cellSize: number;
  /** 0=neutral · 1=player · 2=enemy · 3=contested */
  ownership: Uint8Array;
  /** Global region id for cells inside player territory; −1 otherwise. */
  playerMap: Int16Array;
  /** Global region id for cells inside enemy territory; −1 otherwise. */
  enemyMap: Int16Array;
  /** All regions (both owners) indexed by global id. */
  regions: TerritoryRegion[];
}

export interface GameState {
  tick: number;
  rng: Rng;
  units: Unit[];
  cities: City[];
  terrain: TerrainGrid;
  world: { width: number; height: number };
  /** Money held by each owner (M4). */
  money: { player: number; enemy: number };
  /** Territory connected-component data; recomputed every ~1 s (M5). */
  territory: TerritoryData | null;
  /** Match phase and elapsed time in seconds (M6). */
  matchPhase: MatchPhase;
  matchTime: number;
  /** Numbered squads — player assigns with Ctrl+1–9 (M8). */
  squads: Squad[];
  /** Short-lived gun-fire tracer lines; aged and cleared by the renderer (M8). */
  tracers: Tracer[];
}

let nextUnitId = 0;

export function makeUnit(owner: Owner, kind: UnitKind, x: number, y: number): Unit {
  const def = UNIT_TYPES[kind];
  return {
    id: nextUnitId++,
    owner,
    kind,
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    radius: def.radius,
    waypoints: [],
    waypointIdx: 0,
    stopped: true,
    selected: false,
    squadId: null,
    squadSlot: 0,
    hp: def.maxHp,
    maxHp: def.maxHp,
    dps: def.dps,
    morale: CONFIG.COMBAT.MORALE_MAX,
    inCombat: false,
    attacking: false,
    routTimer: 0,
    dmgTaken: 0,
    flashTimer: 0,
    target: null,
    starving: false,
  };
}

/** Spawn `count` units of `kind` on passable cells around a centre point. */
function spawnArmy(
  units: Unit[],
  rng: Rng,
  terrain: TerrainGrid,
  centre: Vec2,
  owner: Owner,
  kind: UnitKind,
  count: number,
): void {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 40) {
    guard++;
    const ang = randRange(rng, 0, Math.PI * 2);
    const dist = Math.sqrt(rng()) * CONFIG.MAP.SPAWN_RADIUS;
    const x = centre.x + Math.cos(ang) * dist;
    const y = centre.y + Math.sin(ang) * dist;
    if (x < 10 || y < 10 || x > CONFIG.WORLD.WIDTH - 10 || y > CONFIG.WORLD.HEIGHT - 10) continue;
    if (!isPassable(terrain, x, y)) continue;
    units.push(makeUnit(owner, kind, x, y));
    placed++;
  }
}

/** M2: a procedurally generated map with a player army near its capital. */
export function createInitialState(seed: number): GameState {
  nextUnitId = 0;
  const rng = mulberry32(seed);
  const map = generateMap(seed);
  const world = { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT };

  const playerCapital =
    map.cities.find((c) => c.owner === 'player' && c.isCapital) ?? map.cities[0]!;
  const enemyCapital =
    map.cities.find((c) => c.owner === 'enemy' && c.isCapital) ?? map.cities[map.cities.length - 1]!;

  const { START_INFANTRY, START_TANKS, START_ARTILLERY, START_DRONES } = CONFIG.MAP;
  const units: Unit[] = [];
  spawnArmy(units, rng, map.grid, playerCapital.pos, 'player', 'infantry', START_INFANTRY);
  spawnArmy(units, rng, map.grid, playerCapital.pos, 'player', 'tank', START_TANKS);
  spawnArmy(units, rng, map.grid, playerCapital.pos, 'player', 'artillery', START_ARTILLERY);
  spawnArmy(units, rng, map.grid, playerCapital.pos, 'player', 'drone', START_DRONES);
  spawnArmy(units, rng, map.grid, enemyCapital.pos, 'enemy', 'infantry', START_INFANTRY);
  spawnArmy(units, rng, map.grid, enemyCapital.pos, 'enemy', 'tank', START_TANKS);
  spawnArmy(units, rng, map.grid, enemyCapital.pos, 'enemy', 'artillery', START_ARTILLERY);
  spawnArmy(units, rng, map.grid, enemyCapital.pos, 'enemy', 'drone', START_DRONES);

  const money = { player: CONFIG.ECONOMY.START_MONEY, enemy: CONFIG.ECONOMY.START_MONEY };
  return {
    tick: 0, rng, units, cities: map.cities, terrain: map.grid, world, money,
    territory: null, matchPhase: 'playing', matchTime: 0,
    squads: [], tracers: [],
  };
}
