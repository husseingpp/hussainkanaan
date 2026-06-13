// One fixed simulation tick (BLUEPRINT.md §4). Orchestrates the pure systems in
// a fixed order with a single spatial-hash rebuild shared by combat and
// movement. Pure: no DOM/canvas/Date.now/Math.random.

import { CONFIG } from '../config';
import type { SpatialHash } from '../core/spatial-hash';
import type { GameState, Unit } from '../core/state';
import { stepCombat } from './combat';
import { stepEconomy } from './economy';
import { stepMovement } from './movement';
import { computeTerritories } from './territory';

export function stepSimulation(state: GameState, hash: SpatialHash<Unit>, dt: number): void {
  // Snapshot positions for render interpolation before anything moves.
  for (const u of state.units) {
    u.prevPos.x = u.pos.x;
    u.prevPos.y = u.pos.y;
  }

  hash.rebuild(state.units);
  stepCombat(state, hash, dt);

  // Remove the dead, then rebuild so movement separation ignores them.
  if (state.units.some((u) => u.hp <= 0)) {
    state.units = state.units.filter((u) => u.hp > 0);
    hash.rebuild(state.units);
  }

  stepMovement(state, hash, dt);
  stepEconomy(state, hash, dt);

  // Recompute territory every STAGGER ticks (≈1 s). Run on tick 0 for instant coverage.
  if (state.tick % CONFIG.TERRITORY.STAGGER === 0) {
    state.territory = computeTerritories(state);
  }

  state.tick++;
}
