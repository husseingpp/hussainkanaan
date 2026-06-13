// Pure simulation movement (BLUEPRINT.md §4): path following + boids separation
// + terrain speed modifiers + mountain wall-sliding. No DOM, no canvas, no
// Date.now(), no Math.random().

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Unit, Vec2 } from '../core/state';
import { isPassable, speedMul, terrainAt } from './terrain';

const { SEPARATION_RADIUS, SEPARATION_ACCEL, SPEED_RELAX_RATE, ARRIVAL_RADIUS, DECEL_RADIUS } =
  CONFIG.MOVEMENT;

// Reused scratch array — zero allocation in the hot loop (BLUEPRINT.md §8).
const neighbors: Unit[] = [];

/** Base march speed for a unit kind on plains. */
function baseSpeed(unit: Unit): number {
  return unit.kind === 'heavy' ? CONFIG.UNIT.HEAVY_SPEED : CONFIG.UNIT.LIGHT_SPEED;
}

/** Desired velocity toward the current waypoint at `speed` (already terrain-scaled).
 *  Advances waypointIdx and clears the path on arrival. */
function desiredVel(unit: Unit, speed: number): Vec2 {
  if (unit.waypoints.length === 0) return { x: 0, y: 0 };

  while (unit.waypointIdx < unit.waypoints.length - 1) {
    const wp = unit.waypoints[unit.waypointIdx]!;
    if (Math.hypot(wp.x - unit.pos.x, wp.y - unit.pos.y) < ARRIVAL_RADIUS) unit.waypointIdx++;
    else break;
  }

  const wp = unit.waypoints[unit.waypointIdx]!;
  const dx = wp.x - unit.pos.x;
  const dy = wp.y - unit.pos.y;
  const dist = Math.hypot(dx, dy);
  const isLast = unit.waypointIdx >= unit.waypoints.length - 1;

  if (isLast && dist < ARRIVAL_RADIUS) {
    unit.waypoints = [];
    unit.waypointIdx = 0;
    unit.stopped = true;
    return { x: 0, y: 0 };
  }
  if (dist < 0.5) return { x: 0, y: 0 };

  const topSpeed = isLast && dist < DECEL_RADIUS ? speed * (dist / DECEL_RADIUS) : speed;
  return { x: (dx / dist) * topSpeed, y: (dy / dist) * topSpeed };
}

/** Apply steering + integration for one tick. Assumes prevPos has been
 *  snapshotted and `hash` already holds the live units (see simulate.ts). */
export function stepMovement(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  const { units, world, terrain } = state;

  const relax = Math.min(SPEED_RELAX_RATE * dt, 1);
  const maxSpd = CONFIG.UNIT.LIGHT_SPEED * 1.8;

  for (const unit of units) {
    // Terrain under the unit scales its march speed (light vs heavy differ).
    const heavy = unit.kind === 'heavy';
    const terrainMul = speedMul(terrainAt(terrain, unit.pos.x, unit.pos.y), heavy);
    const dv = desiredVel(unit, baseSpeed(unit) * terrainMul);

    // Boids separation so units never overlap.
    hash.queryRadius(unit.pos.x, unit.pos.y, SEPARATION_RADIUS, neighbors);
    let sepX = 0;
    let sepY = 0;
    for (const other of neighbors) {
      if (other === unit) continue;
      const dx = unit.pos.x - other.pos.x;
      const dy = unit.pos.y - other.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) {
        const weight = 1 - dist / SEPARATION_RADIUS;
        sepX += (dx / dist) * weight;
        sepY += (dy / dist) * weight;
      } else {
        sepX += unit.id > other.id ? 1 : -1;
      }
    }

    unit.vel.x += (dv.x - unit.vel.x) * relax + sepX * SEPARATION_ACCEL * dt;
    unit.vel.y += (dv.y - unit.vel.y) * relax + sepY * SEPARATION_ACCEL * dt;

    const spd = Math.hypot(unit.vel.x, unit.vel.y);
    if (spd > maxSpd) {
      unit.vel.x = (unit.vel.x / spd) * maxSpd;
      unit.vel.y = (unit.vel.y / spd) * maxSpd;
    }

    // Axis-separated integration so units slide along mountain walls.
    const nx = unit.pos.x + unit.vel.x * dt;
    const ny = unit.pos.y + unit.vel.y * dt;
    if (isPassable(terrain, nx, unit.pos.y)) unit.pos.x = nx;
    else unit.vel.x = 0;
    if (isPassable(terrain, unit.pos.x, ny)) unit.pos.y = ny;
    else unit.vel.y = 0;

    // Clamp to world bounds.
    if (unit.pos.x < unit.radius) { unit.pos.x = unit.radius; unit.vel.x = Math.abs(unit.vel.x); }
    else if (unit.pos.x > world.width - unit.radius) { unit.pos.x = world.width - unit.radius; unit.vel.x = -Math.abs(unit.vel.x); }
    if (unit.pos.y < unit.radius) { unit.pos.y = unit.radius; unit.vel.y = Math.abs(unit.vel.y); }
    else if (unit.pos.y > world.height - unit.radius) { unit.pos.y = world.height - unit.radius; unit.vel.y = -Math.abs(unit.vel.y); }
  }
}

/** Stop a unit in place and clear its orders. */
export function stopUnit(unit: Unit): void {
  unit.waypoints = [];
  unit.waypointIdx = 0;
  unit.stopped = true;
  unit.vel.x = 0;
  unit.vel.y = 0;
}

/** Assign a new ordered path to a unit. Clears the stopped flag. */
export function assignPath(unit: Unit, waypoints: Vec2[]): void {
  unit.waypoints = waypoints;
  unit.waypointIdx = 0;
  unit.stopped = false;
}
