// Combat, morale, healing (BLUEPRINT.md §5.2). Pure: reads/writes GameState,
// no DOM/canvas/Date.now/Math.random. Runs before movement each tick.
//
// Key rule (§5.2): a unit "attacking" (engaging while under a move order) takes
// +30% incoming damage and loses morale 2× faster — this creates the
// defend-bait-counterattack meta. Terrain cuts damage too (§5.4).

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { City, GameState, Unit } from '../core/state';
import { Terrain, damageMul, terrainAt, type TerrainType } from './terrain';

const C = CONFIG.COMBAT;

// Reused scratch arrays — zero allocation in the hot loop (BLUEPRINT.md §8).
const inRange: Unit[] = [];

/** Damage per second this unit outputs, after morale and terrain modifiers. */
export function attackOutput(unit: Unit, terrain: TerrainType): number {
  const moraleMul = unit.morale < C.MORALE_LOW ? C.LOW_MORALE_DAMAGE_MULT : 1;
  return unit.dps * moraleMul * damageMul(terrain, unit.kind === 'heavy');
}

/** Multiplier on damage a unit receives (attackers are more exposed). */
export function incomingMult(target: Unit): number {
  return target.attacking ? C.ATTACKER_DAMAGE_MULT : 1;
}

/** Nearest enemy of `unit` within `range`, or null. Uses the spatial hash. */
function nearestEnemy(unit: Unit, hash: SpatialHash<Unit>, range: number): Unit | null {
  hash.queryRadius(unit.pos.x, unit.pos.y, range, inRange);
  let best: Unit | null = null;
  let bestD2 = Infinity;
  for (const other of inRange) {
    if (other.owner === unit.owner || other.hp <= 0) continue;
    const dx = other.pos.x - unit.pos.x;
    const dy = other.pos.y - unit.pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = other;
    }
  }
  return best;
}

/** Is any living enemy within `radius` of the unit? (For "safe to heal".) */
function enemyWithin(unit: Unit, hash: SpatialHash<Unit>, radius: number): boolean {
  hash.queryRadius(unit.pos.x, unit.pos.y, radius, inRange);
  for (const other of inRange) {
    if (other.owner !== unit.owner && other.hp > 0) return true;
  }
  return false;
}

/** Friendly city whose radius contains the unit, or null. */
function cityContaining(unit: Unit, cities: readonly City[]): City | null {
  for (const city of cities) {
    if (city.owner !== unit.owner) continue;
    const dx = city.pos.x - unit.pos.x;
    const dy = city.pos.y - unit.pos.y;
    if (dx * dx + dy * dy <= city.radius * city.radius) return city;
  }
  return null;
}

function nearestFriendlyCity(unit: Unit, cities: readonly City[]): City | null {
  let best: City | null = null;
  let bestD2 = Infinity;
  for (const city of cities) {
    if (city.owner !== unit.owner) continue;
    const dx = city.pos.x - unit.pos.x;
    const dy = city.pos.y - unit.pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = city;
    }
  }
  return best;
}

export function stepCombat(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  const { units, cities, terrain } = state;
  const range = CONFIG.UNIT.ATTACK_RANGE;

  // Pass 1: targeting + engagement flags. Must finish before damage so each
  // target's `attacking` flag is known when computing incoming damage.
  for (const u of units) {
    u.dmgTaken = 0;
    u.inCombat = false;
    u.attacking = false;
    u.target = null;
    if (u.hp <= 0) continue;

    const enemy = nearestEnemy(u, hash, range);
    if (enemy) {
      u.target = enemy;
      u.inCombat = true;
      // Engaging while moving into contact = attacking (§5.1).
      u.attacking = u.waypoints.length > 0 && u.routTimer <= 0;
    }
  }

  // Pass 2: accumulate damage onto targets.
  for (const u of units) {
    if (!u.target) continue;
    const out = attackOutput(u, terrainAt(terrain, u.pos.x, u.pos.y));
    u.target.dmgTaken += out * incomingMult(u.target) * dt;
  }

  // Pass 3: apply damage, morale, rout, water drain, healing, flash decay.
  for (const u of units) {
    if (u.hp <= 0) continue;

    if (u.dmgTaken > 0) {
      u.hp -= u.dmgTaken;
      u.flashTimer = C.FLASH_DURATION;
    }

    // Morale: drains in combat (faster when attacking), regenerates otherwise.
    if (u.inCombat) {
      u.morale -= C.MORALE_DRAIN * dt * (u.attacking ? C.ATTACKER_MORALE_MULT : 1);
    } else {
      u.morale += C.MORALE_REGEN * dt;
    }
    if (u.morale > C.MORALE_MAX) u.morale = C.MORALE_MAX;
    if (u.morale < 0) u.morale = 0;

    // Rout: at morale 0, flee to the nearest friendly city, uncontrollable.
    if (u.routTimer > 0) {
      u.routTimer -= dt;
      if (u.routTimer <= 0) u.morale = C.ROUT_RECOVER_MORALE;
    } else if (u.morale <= 0) {
      u.routTimer = C.ROUT_DURATION;
      const refuge = nearestFriendlyCity(u, cities);
      if (refuge) {
        u.waypoints = [{ x: refuge.pos.x, y: refuge.pos.y }];
        u.waypointIdx = 0;
        u.stopped = false;
      }
    }

    // Water saps HP (§5.4).
    if (terrainAt(terrain, u.pos.x, u.pos.y) === Terrain.Water) {
      u.hp -= CONFIG.TERRAIN.WATER_HP_DRAIN * dt;
    }

    // Healing: cities always heal; the field heals only when no enemy is near.
    if (u.hp < u.maxHp) {
      if (cityContaining(u, cities)) {
        u.hp += C.HEAL_CITY * dt;
      } else if (!enemyWithin(u, hash, C.HEAL_SAFE_RADIUS)) {
        u.hp += C.HEAL_FIELD * dt;
      }
      if (u.hp > u.maxHp) u.hp = u.maxHp;
    }

    if (u.flashTimer > 0) u.flashTimer -= dt;
  }
}
