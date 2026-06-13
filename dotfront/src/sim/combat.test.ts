import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { SpatialHash } from '../core/spatial-hash';
import { makeUnit, type GameState, type Owner, type Unit, type UnitKind } from '../core/state';
import { attackOutput, incomingMult, stepCombat } from './combat';
import { stepSimulation } from './simulate';
import { Terrain, makeGrid, type TerrainGrid, type TerrainType } from './terrain';

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
  };
}

// Spawn `n` units of a kind clustered tightly around (cx, cy).
function squad(owner: Owner, kind: UnitKind, n: number, cx: number, cy: number): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    // Pack them in a small grid so everyone is within attack range of foes.
    const x = cx + (i % 6) * 2;
    const y = cy + Math.floor(i / 6) * 2;
    out.push(makeUnit(owner, kind, x, y));
  }
  return out;
}

const alive = (units: Unit[], owner: Owner) => units.filter((u) => u.owner === owner && u.hp > 0).length;

describe('damage math (§5.2)', () => {
  it('a light unit outputs its base DPS on plains at full morale', () => {
    const u = makeUnit('player', 'light', 0, 0);
    expect(attackOutput(u, Terrain.Plains)).toBe(CONFIG.UNIT.LIGHT_DPS);
  });

  it('low morale halves damage output', () => {
    const u = makeUnit('player', 'light', 0, 0);
    u.morale = CONFIG.COMBAT.MORALE_LOW - 1;
    expect(attackOutput(u, Terrain.Plains)).toBe(CONFIG.UNIT.LIGHT_DPS * 0.5);
  });

  it('heavy damage is cut 60% in forest, lights unaffected', () => {
    const heavy = makeUnit('player', 'heavy', 0, 0);
    const light = makeUnit('player', 'light', 0, 0);
    expect(attackOutput(heavy, Terrain.Forest)).toBeCloseTo(CONFIG.UNIT.HEAVY_DPS * 0.4);
    expect(attackOutput(light, Terrain.Forest)).toBe(CONFIG.UNIT.LIGHT_DPS);
  });

  it('attacking units take +30% incoming damage', () => {
    const defender = makeUnit('player', 'light', 0, 0);
    const attacker = makeUnit('player', 'light', 0, 0);
    attacker.attacking = true;
    expect(incomingMult(defender)).toBe(1);
    expect(incomingMult(attacker)).toBe(CONFIG.COMBAT.ATTACKER_DAMAGE_MULT);
  });
});

describe('skirmish: 30 light vs 12 heavy (M3 gate)', () => {
  // Both sides stationary (defending) so the attacker penalty doesn't apply —
  // this isolates raw HP/DPS, which the blueprint balanced to be equal.
  function runSkirmish(terrain: TerrainType): { blue: number; red: number } {
    const units = [...squad('player', 'light', 30, 600, 600), ...squad('enemy', 'heavy', 12, 612, 600)];
    const state = makeState(units, uniformGrid(terrain));
    const hash = new SpatialHash<Unit>();
    // Disable healing/regen drift by running a bounded number of ticks.
    for (let i = 0; i < 1200; i++) {
      stepCombat(state, hash, CONFIG.TICK_MS / 1000);
      state.units = state.units.filter((u) => u.hp > 0);
      hash.rebuild(state.units);
      if (alive(state.units, 'player') === 0 || alive(state.units, 'enemy') === 0) break;
    }
    return { blue: alive(state.units, 'player'), red: alive(state.units, 'enemy') };
  }

  it('is roughly even on plains', () => {
    const { blue, red } = runSkirmish(Terrain.Plains);
    // The blueprint balanced these forces to equal total HP and DPS, so the
    // fight grinds to an equilibrium where both sides keep a similar fraction —
    // neither is wiped, neither dominates.
    expect(blue).toBeGreaterThan(0);
    expect(red).toBeGreaterThan(0);
    expect(blue).toBeLessThan(30);
    expect(red).toBeLessThan(12);
    const blueFrac = blue / 30;
    const redFrac = red / 12;
    expect(Math.abs(blueFrac - redFrac)).toBeLessThan(0.25);
  });

  it('lights win clearly in forest', () => {
    const { blue, red } = runSkirmish(Terrain.Forest);
    // Heavies are crushed (−60% damage); lights dominate. A few heavies may
    // linger out of attack range, but the result is a lopsided light victory.
    expect(red).toBeLessThanOrEqual(4);
    expect(blue).toBeGreaterThanOrEqual(15);
    expect(blue).toBeGreaterThan(red * 3);
  });
});

describe('attacker penalty: attacking into a defended position loses', () => {
  it('equal light squads — attackers take more net damage', () => {
    const defenders = squad('player', 'light', 12, 600, 600);
    const attackers = squad('enemy', 'light', 12, 614, 600);
    for (const a of attackers) {
      a.waypoints = [{ x: 600, y: 600 }];
      a.stopped = false;
    }
    const units = [...defenders, ...attackers];
    const state = makeState(units, uniformGrid(Terrain.Plains));
    const hash = new SpatialHash<Unit>();

    // Run ~2s — long enough to draw blood, short enough that morale hasn't
    // routed anyone yet, so we measure the raw +30% incoming-damage penalty.
    for (let i = 0; i < 40; i++) {
      stepSimulation(state, hash, CONFIG.TICK_MS / 1000);
      // Keep the attack order alive so attackers stay flagged attacking.
      for (const a of state.units) {
        if (a.owner === 'enemy') {
          a.waypoints = [{ x: 600, y: 600 }];
          a.stopped = false;
        }
      }
    }

    const totalHp = (owner: Owner) =>
      state.units.filter((u) => u.owner === owner).reduce((s, u) => s + Math.max(0, u.hp), 0);
    // Attackers (enemy) absorbed more damage than the defenders they charged.
    expect(totalHp('enemy')).toBeLessThan(totalHp('player'));
  });
});
