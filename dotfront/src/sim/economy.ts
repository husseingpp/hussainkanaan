// Economy, production & capture (BLUEPRINT.md §5.3). Pure: no DOM/canvas/
// Date.now/Math.random. Runs after combat + movement each tick.
//
// Income: each owned city produces CITY_INCOME money/s.
// Supply: each owned city provides SUPPLY_PER_CITY supply weight. Field units
//   (outside all friendly city radii) consume supply weight (light 1, heavy 2).
//   Over-cap field units take STARVATION_DPS damage/s (farthest cities first).
// Capture: a unit holding an enemy/neutral city uncontested for CAPTURE_TIME
//   seconds converts it to the captor's faction.
// Production: a queued unit advances its spawn timer; on completion it spawns
//   at the city edge pointing outward.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import { makeUnit, type City, type GameState, type Owner, type TerritoryData, type Unit } from '../core/state';
import { UNIT_TYPES } from './unit-types';
import { assignPath } from './movement';

const E = CONFIG.ECONOMY;

// ── helpers ──────────────────────────────────────────────────────────────────

function isInsideCity(unit: Unit, city: City): boolean {
  const dx = unit.pos.x - city.pos.x;
  const dy = unit.pos.y - city.pos.y;
  return dx * dx + dy * dy <= city.radius * city.radius;
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ── income ────────────────────────────────────────────────────────────────────

function applyIncome(state: GameState, dt: number): void {
  for (const city of state.cities) {
    if (city.owner === 'player') state.money.player += E.CITY_INCOME * dt;
    else if (city.owner === 'enemy') state.money.enemy += E.CITY_INCOME * dt;
  }
}

// ── money upkeep + supply starvation ─────────────────────────────────────────

export function computeSupply(
  units: readonly Unit[],
  cities: readonly City[],
  owner: Owner,
): { fieldWeight: number; capacity: number } {
  const ownedCities = cities.filter((c) => c.owner === owner);
  const capacity = ownedCities.length * E.SUPPLY_PER_CITY;

  let fieldWeight = 0;
  for (const u of units) {
    if (u.owner !== owner || u.hp <= 0) continue;
    // Units inside a friendly city radius cost no upkeep.
    const inCity = ownedCities.some((c) => isInsideCity(u, c));
    if (!inCity) {
      fieldWeight += UNIT_TYPES[u.kind].supplyWeight;
    }
  }
  return { fieldWeight, capacity };
}

function applyUpkeepAndStarvation(state: GameState, dt: number): void {
  for (const owner of ['player', 'enemy'] as const) {
    const ownedCities = state.cities.filter((c) => c.owner === owner);

    // Collect field units (alive, outside all friendly city radii).
    const fieldUnits: Unit[] = [];
    for (const u of state.units) {
      if (u.owner !== owner || u.hp <= 0) continue;
      if (!ownedCities.some((c) => isInsideCity(u, c))) fieldUnits.push(u);
    }

    // Money upkeep (floors at 0).
    const moneyDrain = fieldUnits.reduce(
      (s, u) => s + UNIT_TYPES[u.kind].moneyUpkeep * dt,
      0,
    );
    if (owner === 'player') state.money.player = Math.max(0, state.money.player - moneyDrain);
    else state.money.enemy = Math.max(0, state.money.enemy - moneyDrain);

    // Clear last tick's starving flags.
    for (const u of fieldUnits) u.starving = false;

    if (state.territory) {
      applyRegionalStarvation(owner, fieldUnits, ownedCities, state.territory, dt);
    } else {
      applyGlobalStarvation(owner, fieldUnits, ownedCities, dt);
    }
  }

  // Units in friendly cities are never starving.
  for (const u of state.units) {
    if (state.cities.some((c) => c.owner === u.owner && isInsideCity(u, c))) u.starving = false;
  }
}

/** M4 fallback: global supply from all owned cities. */
function applyGlobalStarvation(
  _owner: Owner,
  fieldUnits: Unit[],
  ownedCities: City[],
  dt: number,
): void {
  const capacity = ownedCities.length * E.SUPPLY_PER_CITY;
  const fieldWeight = fieldUnits.reduce(
    (s, u) => s + UNIT_TYPES[u.kind].supplyWeight, 0,
  );
  if (fieldWeight <= capacity) return;
  starveOverCap(fieldUnits, fieldWeight - capacity, ownedCities, dt);
}

/** M5: per-region supply — pocketed units have zero capacity. */
function applyRegionalStarvation(
  owner: 'player' | 'enemy',
  fieldUnits: Unit[],
  ownedCities: City[],
  territory: TerritoryData,
  dt: number,
): void {
  const map = owner === 'player' ? territory.playerMap : territory.enemyMap;
  const { cols, rows, cellSize, regions } = territory;

  // Group field units by their territory region.
  const byRegion = new Map<number, Unit[]>();
  const unconnected: Unit[] = [];

  for (const u of fieldUnits) {
    const col = Math.min(Math.max(Math.floor(u.pos.x / cellSize), 0), cols - 1);
    const row = Math.min(Math.max(Math.floor(u.pos.y / cellSize), 0), rows - 1);
    const rId = map[row * cols + col] ?? -1;
    if (rId < 0) {
      unconnected.push(u);
    } else {
      const arr = byRegion.get(rId);
      if (arr) arr.push(u);
      else byRegion.set(rId, [u]);
    }
  }

  // Units outside any territory → pocket with zero supply.
  for (const u of unconnected) {
    u.starving = true;
    u.hp -= E.STARVATION_DPS * dt;
  }

  // Per-region starvation.
  for (const [rId, units] of byRegion) {
    const region = regions[rId];
    if (!region) continue;
    const capacity = region.supplyCapacity; // 0 for pockets
    const fieldWeight = units.reduce(
      (s, u) => s + UNIT_TYPES[u.kind].supplyWeight, 0,
    );
    if (fieldWeight > capacity) {
      starveOverCap(units, fieldWeight - capacity, ownedCities, dt);
    }
  }
}

/** Apply starvation to the `overWeight` excess, farthest-from-city first. */
function starveOverCap(units: Unit[], overWeight: number, cities: City[], dt: number): void {
  units.sort((a, b) => {
    const dA = cities.length > 0
      ? Math.min(...cities.map((c) => distSq(a.pos.x, a.pos.y, c.pos.x, c.pos.y)))
      : Infinity;
    const dB = cities.length > 0
      ? Math.min(...cities.map((c) => distSq(b.pos.x, b.pos.y, c.pos.x, c.pos.y)))
      : Infinity;
    return dB - dA;
  });
  let covered = 0;
  for (const u of units) {
    if (covered >= overWeight) break;
    const w = UNIT_TYPES[u.kind].supplyWeight;
    u.starving = true;
    u.hp -= E.STARVATION_DPS * dt;
    covered += w;
  }
}

// ── capture ───────────────────────────────────────────────────────────────────

// Scratch array reused per city query.
const inRadius: Unit[] = [];

function stepCapture(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  for (const city of state.cities) {
    hash.queryRadius(city.pos.x, city.pos.y, city.radius, inRadius);

    let playerPresent = false;
    let enemyPresent = false;
    for (const u of inRadius) {
      if (u.hp <= 0) continue;
      if (u.owner === 'player') playerPresent = true;
      if (u.owner === 'enemy') enemyPresent = true;
    }

    // Determine if one faction holds it uncontested.
    const contested = playerPresent && enemyPresent;

    for (const captor of ['player', 'enemy'] as const) {
      if (city.owner === captor) continue; // already owned

      const captorPresent = captor === 'player' ? playerPresent : enemyPresent;
      const opponentPresent = captor === 'player' ? enemyPresent : playerPresent;

      if (captorPresent && !opponentPresent) {
        if (city.captureBy !== captor) {
          // New captor takes over; reset progress.
          city.captureBy = captor;
          city.captureProgress = 0;
        }
        city.captureProgress += dt;
        if (city.captureProgress >= E.CAPTURE_TIME) {
          city.owner = captor;
          city.captureProgress = 0;
          city.captureBy = null;
        }
        break;
      }
    }

    // Contested or empty: freeze/reset capture progress.
    if (contested || (!playerPresent && !enemyPresent)) {
      if (city.captureBy !== null) {
        city.captureProgress = 0;
        city.captureBy = null;
      }
    }
  }
}

// ── production ────────────────────────────────────────────────────────────────

function stepProduction(state: GameState, dt: number): void {
  for (const city of state.cities) {
    if (city.productionQueue.length === 0) continue;
    if (city.owner === 'neutral') continue;

    const job = city.productionQueue[0]!;
    job.progress += dt;

    if (job.progress >= UNIT_TYPES[job.kind].spawnTime) {
      // Spawn on a random edge of the city using the seeded RNG.
      const angle = state.rng() * Math.PI * 2;
      const sx = city.pos.x + Math.cos(angle) * (city.radius + 8);
      const sy = city.pos.y + Math.sin(angle) * (city.radius + 8);
      const unit = makeUnit(city.owner, job.kind, sx, sy);
      if (job.rallyPoint) {
        assignPath(unit, [{ x: job.rallyPoint.x, y: job.rallyPoint.y }]);
      }
      state.units.push(unit);
      city.productionQueue.shift();
    }
  }
}

// ── main step ─────────────────────────────────────────────────────────────────

export function stepEconomy(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  applyIncome(state, dt);
  applyUpkeepAndStarvation(state, dt);
  stepCapture(state, hash, dt);
  stepProduction(state, dt);
}
