import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { SpatialHash } from '../core/spatial-hash';
import { makeUnit, type GameState, type Owner, type Unit, type UnitKind } from '../core/state';
import { attackOutput, incomingMult, stepCombat } from './combat';
import { stepSimulation } from './simulate';
import { Terrain, makeGrid, type TerrainGrid, type TerrainType } from './terrain';
import { UNIT_TYPES } from './unit-types';

function uniformGrid(t: TerrainType): TerrainGrid {
  const grid = makeGrid(80, 60, CONFIG.TERRAIN.CELL_SIZE);
  grid.cells.fill(t);
  return grid;
}

function makeState(units: Unit[], terrain: TerrainGrid): GameState {
  return {
    tick: 0,
    rng: () => 0.5,
    units,
    cities: [],
    terrain,
    world: { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT },
    money: { player: 0, enemy: 0 },
    territory: null,
    matchPhase: 'playing',
    matchTime: 0,
    squads: [],
    tracers: [],
  };
}

// Spawn `n` units of a kind clustered tightly around (cx, cy).
function squad(owner: Owner, kind: UnitKind, n: number, cx: number, cy: number): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx + (i % 6) * 2;
    const y = cy + Math.floor(i / 6) * 2;
    out.push(makeUnit(owner, kind, x, y));
  }
  return out;
}

const alive = (units: Unit[], owner: Owner) => units.filter((u) => u.owner === owner && u.hp > 0).length;

describe('damage math (§5.2)', () => {
  it('an infantry unit outputs its base DPS on plains at full morale at short range', () => {
    const u = makeUnit('player', 'infantry', 0, 0);
    // dist=0 is within short range band → damageMul=1.0, terrainDamage[plains]=1.0
    expect(attackOutput(u, Terrain.Plains, 0)).toBe(UNIT_TYPES.infantry.dps);
  });

  it('low morale halves damage output', () => {
    const u = makeUnit('player', 'infantry', 0, 0);
    u.morale = CONFIG.COMBAT.MORALE_LOW - 1;
    expect(attackOutput(u, Terrain.Plains, 0)).toBe(UNIT_TYPES.infantry.dps * 0.5);
  });

  it('tank damage is cut in forest; infantry less so', () => {
    const tank = makeUnit('player', 'tank', 0, 0);
    const inf  = makeUnit('player', 'infantry', 0, 0);
    expect(attackOutput(tank, Terrain.Forest, 0)).toBeCloseTo(UNIT_TYPES.tank.dps * 0.6);
    expect(attackOutput(inf, Terrain.Forest, 0)).toBeCloseTo(UNIT_TYPES.infantry.dps * 0.8);
  });

  it('damage falls off at medium range', () => {
    const inf = makeUnit('player', 'infantry', 0, 0);
    // dist=90 is beyond short threshold (60) but within medium (120) → damageMul=0.6
    expect(attackOutput(inf, Terrain.Plains, 90)).toBeCloseTo(UNIT_TYPES.infantry.dps * 0.6);
  });

  it('returns 0 beyond max range', () => {
    const inf = makeUnit('player', 'infantry', 0, 0);
    // dist=250 is beyond infantry max range (200)
    expect(attackOutput(inf, Terrain.Plains, 250)).toBe(0);
  });

  it('attacking units take +30% incoming damage', () => {
    const defender = makeUnit('player', 'infantry', 0, 0);
    const attacker = makeUnit('player', 'infantry', 0, 0);
    attacker.attacking = true;
    expect(incomingMult(defender)).toBe(1);
    expect(incomingMult(attacker)).toBe(CONFIG.COMBAT.ATTACKER_DAMAGE_MULT);
  });
});

describe('skirmish (M3 gate)', () => {
  it('symmetric infantry fight is near-equal on plains', () => {
    // 20 infantry vs 20 infantry: same stats → symmetric losses
    const units = [...squad('player', 'infantry', 20, 600, 600), ...squad('enemy', 'infantry', 20, 612, 600)];
    const state = makeState(units, uniformGrid(Terrain.Plains));
    const hash = new SpatialHash<Unit>();
    for (let i = 0; i < 1200; i++) {
      stepCombat(state, hash, CONFIG.TICK_MS / 1000);
      state.units = state.units.filter((u) => u.hp > 0);
      hash.rebuild(state.units);
      if (alive(state.units, 'player') === 0 || alive(state.units, 'enemy') === 0) break;
    }
    const blue = alive(state.units, 'player');
    const red  = alive(state.units, 'enemy');
    // Both sides must die together (difference ≤ 3 due to symmetry + morale variance).
    expect(Math.abs(blue - red)).toBeLessThanOrEqual(3);
  });

  it('tanks beat equal-DPS infantry due to more total HP', () => {
    // 30 infantry (360 DPS, 2400 HP) vs 12 tanks (360 DPS, 2640 HP)
    // Equal DPS but tanks have more HP → tanks win, but both sides take losses
    const units = [...squad('player', 'infantry', 30, 600, 600), ...squad('enemy', 'tank', 12, 612, 600)];
    const state = makeState(units, uniformGrid(Terrain.Plains));
    const hash = new SpatialHash<Unit>();
    for (let i = 0; i < 1200; i++) {
      stepCombat(state, hash, CONFIG.TICK_MS / 1000);
      state.units = state.units.filter((u) => u.hp > 0);
      hash.rebuild(state.units);
      if (alive(state.units, 'player') === 0 || alive(state.units, 'enemy') === 0) break;
    }
    const red = alive(state.units, 'enemy');
    expect(red).toBeGreaterThan(0); // tanks survive
    // infantry dealt damage — not a trivial win
    expect(red).toBeLessThan(12);
  });

  it('infantry win in forest over tanks (terrain penalty)', () => {
    // In forest: infantry terrainDamage=0.8, tanks=0.6 → infantry DPS advantage
    const units = [...squad('player', 'infantry', 30, 600, 600), ...squad('enemy', 'tank', 12, 612, 600)];
    const state = makeState(units, uniformGrid(Terrain.Forest));
    const hash = new SpatialHash<Unit>();
    for (let i = 0; i < 1200; i++) {
      stepCombat(state, hash, CONFIG.TICK_MS / 1000);
      state.units = state.units.filter((u) => u.hp > 0);
      hash.rebuild(state.units);
      if (alive(state.units, 'player') === 0 || alive(state.units, 'enemy') === 0) break;
    }
    const blue = alive(state.units, 'player');
    const red  = alive(state.units, 'enemy');
    expect(blue).toBeGreaterThan(red);
  });
});

describe('attacker penalty: attacking into a defended position loses', () => {
  it('equal infantry squads — attackers take more net damage', () => {
    const defenders = squad('player', 'infantry', 12, 600, 600);
    const attackers = squad('enemy', 'infantry', 12, 614, 600);
    for (const a of attackers) {
      a.waypoints = [{ x: 600, y: 600 }];
      a.stopped = false;
    }
    const units = [...defenders, ...attackers];
    const state = makeState(units, uniformGrid(Terrain.Plains));
    const hash = new SpatialHash<Unit>();

    for (let i = 0; i < 40; i++) {
      stepSimulation(state, hash, CONFIG.TICK_MS / 1000);
      for (const a of state.units) {
        if (a.owner === 'enemy') {
          a.waypoints = [{ x: 600, y: 600 }];
          a.stopped = false;
        }
      }
    }

    const totalHp = (owner: Owner) =>
      state.units.filter((u) => u.owner === owner).reduce((s, u) => s + Math.max(0, u.hp), 0);
    expect(totalHp('enemy')).toBeLessThan(totalHp('player'));
  });
});
