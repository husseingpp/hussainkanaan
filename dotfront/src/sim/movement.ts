// Pure simulation movement (BLUEPRINT.md §4): boids-style separation so dots
// never overlap, plus drift integration and soft world-bound bounces.
// No DOM, no canvas, no Date.now(), no Math.random() in this module.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Unit } from '../core/state';

// Reused across ticks — zero allocations in the hot loop (BLUEPRINT.md §8).
const neighbors: Unit[] = [];

export function stepMovement(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  const { SEPARATION_RADIUS, SEPARATION_ACCEL, DRIFT_SPEED, SPEED_RELAX_RATE } = CONFIG.MOVEMENT;
  const { units, world } = state;

  for (const unit of units) {
    unit.prevPos.x = unit.pos.x;
    unit.prevPos.y = unit.pos.y;
  }

  hash.rebuild(units);

  for (const unit of units) {
    // Separation: push away from each neighbor, stronger the closer they are.
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
        // Exactly coincident: deterministic tie-break by id so the pair splits.
        sepX += unit.id > other.id ? 1 : -1;
      }
    }
    unit.vel.x += sepX * SEPARATION_ACCEL * dt;
    unit.vel.y += sepY * SEPARATION_ACCEL * dt;

    // Relax speed back toward drift speed so separation bursts fade out.
    const speed = Math.hypot(unit.vel.x, unit.vel.y);
    if (speed > 1e-6) {
      const target = speed + (DRIFT_SPEED - speed) * Math.min(SPEED_RELAX_RATE * dt, 1);
      const scale = target / speed;
      unit.vel.x *= scale;
      unit.vel.y *= scale;
    }

    unit.pos.x += unit.vel.x * dt;
    unit.pos.y += unit.vel.y * dt;

    // Bounce off world bounds.
    if (unit.pos.x < unit.radius) {
      unit.pos.x = unit.radius;
      unit.vel.x = Math.abs(unit.vel.x);
    } else if (unit.pos.x > world.width - unit.radius) {
      unit.pos.x = world.width - unit.radius;
      unit.vel.x = -Math.abs(unit.vel.x);
    }
    if (unit.pos.y < unit.radius) {
      unit.pos.y = unit.radius;
      unit.vel.y = Math.abs(unit.vel.y);
    } else if (unit.pos.y > world.height - unit.radius) {
      unit.pos.y = world.height - unit.radius;
      unit.vel.y = -Math.abs(unit.vel.y);
    }
  }

  state.tick++;
}
