// AI Commander (BLUEPRINT.md §6): converts strategist targets into unit
// path orders. Pure: uses state.rng for all randomness; no Math.random.

import { CONFIG } from '../config';
import type { GameState, Unit, Vec2 } from '../core/state';
import { assignPath } from '../sim/movement';
import type { AiTarget } from './strategist';

export function runCommander(targets: AiTarget[], state: GameState): void {
  const assigned = new Set<number>(); // unit IDs committed to an order this tick

  for (const target of targets.slice(0, CONFIG.AI.MAX_ACTIVE_TARGETS)) {
    const candidates = state.units.filter(
      (u) =>
        u.owner === 'enemy' &&
        u.hp > 0 &&
        u.routTimer <= 0 &&
        !assigned.has(u.id) &&
        (target.intent === 'defend' || isIdle(u)),
    );

    // Nearest units first.
    candidates.sort((a, b) => dist2(a.pos, target.pos) - dist2(b.pos, target.pos));

    for (const u of candidates.slice(0, target.unitBudget)) {
      assigned.add(u.id);
      if (target.curved) {
        assignCurved(u, target.pos, state);
      } else {
        assignPath(u, [{ x: target.pos.x, y: target.pos.y }]);
      }
    }
  }
}

/** Curved/flanking path: perpendicular midpoint offset (§6 encircle). */
function assignCurved(u: Unit, target: Vec2, state: GameState): void {
  const dx = target.x - u.pos.x;
  const dy = target.y - u.pos.y;
  const len = Math.hypot(dx, dy);
  if (len < 200) {
    assignPath(u, [{ x: target.x, y: target.y }]);
    return;
  }
  const px = -dy / len;
  const py = dx / len;
  const offset = (state.rng() - 0.5) * len * CONFIG.AI.ENCIRCLE_OFFSET;
  const mid = {
    x: Math.max(50, Math.min(CONFIG.WORLD.WIDTH - 50, (u.pos.x + target.x) / 2 + px * offset)),
    y: Math.max(50, Math.min(CONFIG.WORLD.HEIGHT - 50, (u.pos.y + target.y) / 2 + py * offset)),
  };
  assignPath(u, [mid, { x: target.x, y: target.y }]);
}

function isIdle(u: Unit): boolean {
  return u.stopped || u.waypoints.length === 0 || u.waypointIdx >= u.waypoints.length;
}

function dist2(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
