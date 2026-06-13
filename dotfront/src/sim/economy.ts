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
import { makeUnit, type City, type GameState, type Owner, type Unit } from '../core/state';
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
      fieldWeight += u.kind === 'heavy' ? E.HEAVY_UPKEEP : E.LIGHT_UPKEEP;
    }
  }
  return { fieldWeight, capacity };
}

function applyUpkeepAndStarvation(state: GameState, dt: number): void {
  for (const owner of ['player', 'enemy'] as const) {
    const ownedCities = state.cities.filter((c) => c.owner === owner);
    const capacity = ownedCities.length * E.SUPPLY_PER_CITY;

    // Collect field units (alive, outside all friendly city radii).
    const fieldUnits: Unit[] = [];
    for (const u of state.units) {
      if (u.owner !== owner || u.hp <= 0) continue;
      const inCity = ownedCities.some((c) => isInsideCity(u, c));
      if (!inCity) fieldUnits.push(u);
    }

    // Money upkeep (floors at 0).
    const moneyDrain = fieldUnits.reduce(
      (s, u) => s + (u.kind === 'heavy' ? E.HEAVY_MONEY_UPKEEP : E.LIGHT_MONEY_UPKEEP) * dt,
      0,
    );
    if (owner === 'player') {
      state.money.player = Math.max(0, state.money.player - moneyDrain);
    } else {
      state.money.enemy = Math.max(0, state.money.enemy - moneyDrain);
    }

    // Supply starvation: units beyond capacity take damage (farthest first).
    const fieldWeight = fieldUnits.reduce(
      (s, u) => s + (u.kind === 'heavy' ? E.HEAVY_UPKEEP : E.LIGHT_UPKEEP),
      0,
    );

    // Clear last tick's starving flags.
    for (const u of fieldUnits) u.starving = false;

    if (fieldWeight > capacity) {
      const overWeight = fieldWeight - capacity;

      // Sort field units by distance to nearest friendly city (farthest first).
      fieldUnits.sort((a, b) => {
        const nearA =
          ownedCities.length > 0
            ? Math.min(...ownedCities.map((c) => distSq(a.pos.x, a.pos.y, c.pos.x, c.pos.y)))
            : Infinity;
        const nearB =
          ownedCities.length > 0
            ? Math.min(...ownedCities.map((c) => distSq(b.pos.x, b.pos.y, c.pos.x, c.pos.y)))
            : Infinity;
        return nearB - nearA; // farthest first
      });

      let covered = 0;
      for (const u of fieldUnits) {
        const w = u.kind === 'heavy' ? E.HEAVY_UPKEEP : E.LIGHT_UPKEEP;
        if (covered < overWeight) {
          u.starving = true;
          u.hp -= E.STARVATION_DPS * dt;
          covered += w;
        }
      }
    }
  }

  // Units in friendly cities are never starving.
  for (const u of state.units) {
    const inFriendlyCity = state.cities.some((c) => c.owner === u.owner && isInsideCity(u, c));
    if (inFriendlyCity) u.starving = false;
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

    if (job.progress >= E.SPAWN_TIME) {
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
