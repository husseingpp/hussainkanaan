// Pure simulation movement (BLUEPRINT.md §4): path following + boids separation
// so units never overlap. No DOM, no canvas, no Date.now(), no Math.random().

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Unit, Vec2 } from '../core/state';

const { SEPARATION_RADIUS, SEPARATION_ACCEL, SPEED_RELAX_RATE, DRIFT_SPEED,
        PATH_SPEED, ARRIVAL_RADIUS, DECEL_RADIUS } = CONFIG.MOVEMENT;

// Reused scratch arrays — zero allocation in the hot loop (BLUEPRINT.md §8).
const neighbors: Unit[] = [];

/** Compute desired velocity for a unit given its current orders. Advances the
 *  waypointIdx and clears waypoints on arrival; this is the only state mutation
 *  inside this helper (path bookkeeping, not physics). */
function desiredVel(unit: Unit): Vec2 {
  if (unit.waypoints.length === 0) {
    if (unit.stopped) return { x: 0, y: 0 };
    // Drifting: maintain heading at DRIFT_SPEED (M0 demo behaviour).
    const spd = Math.hypot(unit.vel.x, unit.vel.y);
    if (spd < 0.5) return { x: 0, y: 0 };
    return { x: (unit.vel.x / spd) * DRIFT_SPEED, y: (unit.vel.y / spd) * DRIFT_SPEED };
  }

  // Advance past already-reached waypoints (handles multi-skip on fast units).
  while (unit.waypointIdx < unit.waypoints.length - 1) {
    const wp = unit.waypoints[unit.waypointIdx]!;
    if (Math.hypot(wp.x - unit.pos.x, wp.y - unit.pos.y) < ARRIVAL_RADIUS) {
      unit.waypointIdx++;
    } else {
      break;
    }
  }

  const wp = unit.waypoints[unit.waypointIdx]!;
  const dx = wp.x - unit.pos.x;
  const dy = wp.y - unit.pos.y;
  const dist = Math.hypot(dx, dy);
  const isLast = unit.waypointIdx >= unit.waypoints.length - 1;

  if (isLast && dist < ARRIVAL_RADIUS) {
    // Reached the final waypoint — stop the unit.
    unit.waypoints = [];
    unit.waypointIdx = 0;
    unit.stopped = true;
    return { x: 0, y: 0 };
  }

  if (dist < 0.5) return { x: 0, y: 0 };

  // Decelerate smoothly as we approach the final waypoint.
  const topSpeed = (isLast && dist < DECEL_RADIUS) ? PATH_SPEED * (dist / DECEL_RADIUS) : PATH_SPEED;
  return { x: (dx / dist) * topSpeed, y: (dy / dist) * topSpeed };
}

export function stepMovement(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  const { units, world } = state;

  // Snapshot prevPos before any mutations.
  for (const unit of units) {
    unit.prevPos.x = unit.pos.x;
    unit.prevPos.y = unit.pos.y;
  }

  hash.rebuild(units);

  const relax = Math.min(SPEED_RELAX_RATE * dt, 1);
  const maxSpd = PATH_SPEED * 1.8; // cap prevents separation bursts going wild

  for (const unit of units) {
    // --- desired velocity from path / drift ---
    const dv = desiredVel(unit);

    // --- boids separation ---
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

    // --- integrate velocity ---
    // Lerp toward desired, then add separation impulse.
    unit.vel.x += (dv.x - unit.vel.x) * relax + sepX * SEPARATION_ACCEL * dt;
    unit.vel.y += (dv.y - unit.vel.y) * relax + sepY * SEPARATION_ACCEL * dt;

    // Speed cap.
    const spd = Math.hypot(unit.vel.x, unit.vel.y);
    if (spd > maxSpd) {
      unit.vel.x = (unit.vel.x / spd) * maxSpd;
      unit.vel.y = (unit.vel.y / spd) * maxSpd;
    }

    // --- integrate position ---
    unit.pos.x += unit.vel.x * dt;
    unit.pos.y += unit.vel.y * dt;

    // Soft bounce off world bounds.
    if (unit.pos.x < unit.radius) { unit.pos.x = unit.radius; unit.vel.x = Math.abs(unit.vel.x); }
    else if (unit.pos.x > world.width - unit.radius) { unit.pos.x = world.width - unit.radius; unit.vel.x = -Math.abs(unit.vel.x); }
    if (unit.pos.y < unit.radius) { unit.pos.y = unit.radius; unit.vel.y = Math.abs(unit.vel.y); }
    else if (unit.pos.y > world.height - unit.radius) { unit.pos.y = world.height - unit.radius; unit.vel.y = -Math.abs(unit.vel.y); }
  }

  state.tick++;
}

/** Stop a unit in place and clear its orders. */
export function stopUnit(unit: Unit): void {
  unit.waypoints = [];
  unit.waypointIdx = 0;
  unit.stopped = true;
  unit.vel.x = 0;
  unit.vel.y = 0;
}

/** Assign a new ordered path to a unit. Clears stopped flag. */
export function assignPath(unit: Unit, waypoints: Vec2[]): void {
  unit.waypoints = waypoints;
  unit.waypointIdx = 0;
  unit.stopped = false;
}
