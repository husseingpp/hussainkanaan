// GameState: plain TS objects, no state library (BLUEPRINT.md §3). The sim
// mutates this in place each tick; the renderer only reads it.

import { CONFIG } from '../config';
import { mulberry32, randRange, type Rng } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type Owner = 'player' | 'enemy' | 'neutral';

export interface Unit {
  id: number;
  owner: Owner;
  pos: Vec2;
  /** Position at the previous sim tick — the renderer lerps prevPos→pos. */
  prevPos: Vec2;
  vel: Vec2;
  radius: number;
  /** Ordered path waypoints (world coords). Empty = drifting or stopped. */
  waypoints: Vec2[];
  /** Index into waypoints of the current target. */
  waypointIdx: number;
  /** True when unit has completed a path and should remain still. */
  stopped: boolean;
  selected: boolean;
}

export interface GameState {
  tick: number;
  rng: Rng;
  units: Unit[];
  world: { width: number; height: number };
}

/** M0: a world of drifting player dots with seeded positions and headings. */
export function createInitialState(seed: number): GameState {
  const rng = mulberry32(seed);
  const world = { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT };
  const units: Unit[] = [];

  const margin = 100;
  for (let i = 0; i < CONFIG.M0.DOT_COUNT; i++) {
    const x = randRange(rng, margin, world.width - margin);
    const y = randRange(rng, margin, world.height - margin);
    const heading = randRange(rng, 0, Math.PI * 2);
    units.push({
      id: i,
      owner: 'player',
      pos: { x, y },
      prevPos: { x, y },
      vel: {
        x: Math.cos(heading) * CONFIG.MOVEMENT.DRIFT_SPEED,
        y: Math.sin(heading) * CONFIG.MOVEMENT.DRIFT_SPEED,
      },
      radius: CONFIG.UNIT.LIGHT_RADIUS,
      waypoints: [],
      waypointIdx: 0,
      stopped: false,
      selected: false,
    });
  }

  return { tick: 0, rng, units, world };
}
