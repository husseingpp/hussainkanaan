import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { SpatialHash } from '../core/spatial-hash';
import { makeUnit, type City, type GameState, type Owner, type Unit } from '../core/state';
import { computeSupply, stepEconomy } from './economy';
import { makeGrid, type TerrainGrid } from './terrain';

const E = CONFIG.ECONOMY;

function uniformGrid(): TerrainGrid {
  return makeGrid(80, 60, CONFIG.TERRAIN.CELL_SIZE);
}

function makeCity(id: number, owner: Owner, x: number, y: number, isCapital = false): City {
  return {
    id, owner, pos: { x, y }, radius: CONFIG.MAP.CITY_RADIUS, isCapital,
    captureProgress: 0, captureBy: null, productionQueue: [],
  };
}

function makeState(units: Unit[], cities: City[], terrain = uniformGrid()): GameState {
  return {
    tick: 0,
    rng: () => 0.5,
    units,
    cities,
    terrain,
    world: { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT },
    money: { player: 0, enemy: 0 },
  };
}

// ── income ────────────────────────────────────────────────────────────────────

describe('city income', () => {
  it('owned cities add income each second', () => {
    const state = makeState(
      [],
      [makeCity(0, 'player', 100, 100), makeCity(1, 'enemy', 300, 100)],
    );
    const hash = new SpatialHash<Unit>();
    stepEconomy(state, hash, 1);
    expect(state.money.player).toBeCloseTo(E.CITY_INCOME);
    expect(state.money.enemy).toBeCloseTo(E.CITY_INCOME);
  });

  it('neutral cities produce no income', () => {
    const state = makeState([], [makeCity(0, 'neutral', 200, 200)]);
    const hash = new SpatialHash<Unit>();
    stepEconomy(state, hash, 1);
    expect(state.money.player).toBe(0);
    expect(state.money.enemy).toBe(0);
  });

  it('income scales with number of cities owned', () => {
    const state = makeState(
      [],
      [makeCity(0, 'player', 100, 100), makeCity(1, 'player', 200, 200)],
    );
    const hash = new SpatialHash<Unit>();
    stepEconomy(state, hash, 2);
    // 2 cities × 10/s × 2s = 40
    expect(state.money.player).toBeCloseTo(2 * E.CITY_INCOME * 2);
  });
});

// ── supply ────────────────────────────────────────────────────────────────────

describe('computeSupply', () => {
  it('field units count toward supply weight', () => {
    const city = makeCity(0, 'player', 1000, 1000);
    const light = makeUnit('player', 'light', 100, 100);
    const heavy = makeUnit('player', 'heavy', 200, 100);
    const { fieldWeight, capacity } = computeSupply([light, heavy], [city], 'player');
    expect(fieldWeight).toBe(E.LIGHT_UPKEEP + E.HEAVY_UPKEEP);
    expect(capacity).toBe(E.SUPPLY_PER_CITY);
  });

  it('units inside a friendly city radius cost no supply', () => {
    const city = makeCity(0, 'player', 100, 100);
    // Place unit exactly at city centre — inside radius.
    const u = makeUnit('player', 'light', 100, 100);
    const { fieldWeight } = computeSupply([u], [city], 'player');
    expect(fieldWeight).toBe(0);
  });

  it('capacity scales with number of owned cities', () => {
    const cities = [makeCity(0, 'player', 1000, 1000), makeCity(1, 'player', 2000, 2000)];
    const { capacity } = computeSupply([], cities, 'player');
    expect(capacity).toBe(2 * E.SUPPLY_PER_CITY);
  });
});

// ── starvation ────────────────────────────────────────────────────────────────

describe('starvation', () => {
  it('over-cap field units lose HP', () => {
    // 1 city → capacity 5; spawn 6 light units (weight 6) in the field.
    const city = makeCity(0, 'player', 2000, 2000); // far from units
    const units = Array.from({ length: 6 }, (_, i) => makeUnit('player', 'light', i * 10, 10));
    const state = makeState(units, [city]);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    const initialHp = units[0]!.hp;
    stepEconomy(state, hash, 1);

    const starving = state.units.filter((u) => u.starving);
    expect(starving.length).toBeGreaterThan(0);
    // At least one unit should have lost HP from starvation.
    const damaged = state.units.filter((u) => u.hp < initialHp);
    expect(damaged.length).toBeGreaterThan(0);
  });

  it('under-cap — no starvation', () => {
    // 2 cities → capacity 10; only 3 light units (weight 3) in the field.
    const cities = [makeCity(0, 'player', 2000, 2000), makeCity(1, 'player', 2100, 2000)];
    const units = [
      makeUnit('player', 'light', 100, 100),
      makeUnit('player', 'light', 120, 100),
      makeUnit('player', 'light', 140, 100),
    ];
    const state = makeState(units, cities);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    stepEconomy(state, hash, 1);
    expect(state.units.every((u) => !u.starving)).toBe(true);
  });

  it('units inside a friendly city radius are never starving', () => {
    // 0 cities → capacity 0, but units are inside a friendly city.
    const city = makeCity(0, 'player', 100, 100);
    const u = makeUnit('player', 'light', 100, 100); // at city centre
    const state = makeState([u], [city]);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    stepEconomy(state, hash, 2);
    expect(u.starving).toBe(false);
    expect(u.hp).toBe(u.maxHp);
  });
});

// ── capture ───────────────────────────────────────────────────────────────────

describe('capture', () => {
  it('a unit holding a neutral city uncontested captures it after CAPTURE_TIME', () => {
    const city = makeCity(0, 'neutral', 200, 200);
    const u = makeUnit('player', 'light', 200, 200); // inside city
    const state = makeState([u], [city]);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    // Run slightly more than CAPTURE_TIME to ensure completion.
    stepEconomy(state, hash, E.CAPTURE_TIME + 0.1);
    expect(state.cities[0]!.owner).toBe('player');
  });

  it('capture resets when contested', () => {
    const city = makeCity(0, 'neutral', 200, 200);
    const player = makeUnit('player', 'light', 200, 200);
    const enemy = makeUnit('enemy', 'light', 200, 200);
    const state = makeState([player, enemy], [city]);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    stepEconomy(state, hash, E.CAPTURE_TIME + 1);
    // Contested — should NOT be captured.
    expect(state.cities[0]!.owner).toBe('neutral');
    expect(state.cities[0]!.captureProgress).toBe(0);
  });

  it('capture progress accumulates over multiple ticks', () => {
    const city = makeCity(0, 'neutral', 200, 200);
    const u = makeUnit('player', 'light', 200, 200);
    const state = makeState([u], [city]);
    const hash = new SpatialHash<Unit>();
    hash.rebuild(state.units);

    stepEconomy(state, hash, E.CAPTURE_TIME * 0.4);
    stepEconomy(state, hash, E.CAPTURE_TIME * 0.4);
    // Should be partially captured but not yet done.
    expect(state.cities[0]!.owner).toBe('neutral');
    expect(state.cities[0]!.captureProgress).toBeCloseTo(E.CAPTURE_TIME * 0.8);
  });
});

// ── production ────────────────────────────────────────────────────────────────

describe('production', () => {
  it('a queued light unit spawns after SPAWN_TIME', () => {
    const city = makeCity(0, 'player', 200, 200);
    city.productionQueue.push({ kind: 'light', progress: 0, rallyPoint: null });
    const state = makeState([], [city]);
    const hash = new SpatialHash<Unit>();

    expect(state.units.length).toBe(0);
    stepEconomy(state, hash, E.SPAWN_TIME + 0.01);
    expect(state.units.length).toBe(1);
    expect(state.units[0]!.kind).toBe('light');
    expect(state.units[0]!.owner).toBe('player');
    expect(city.productionQueue.length).toBe(0);
  });

  it('spawned unit marches to the rally point', () => {
    const city = makeCity(0, 'player', 200, 200);
    const rally = { x: 800, y: 800 };
    city.productionQueue.push({ kind: 'light', progress: 0, rallyPoint: rally });
    const state = makeState([], [city]);
    const hash = new SpatialHash<Unit>();

    stepEconomy(state, hash, E.SPAWN_TIME + 0.01);
    const spawned = state.units[0]!;
    expect(spawned.waypoints.length).toBeGreaterThan(0);
    expect(spawned.waypoints[0]).toEqual(rally);
  });

  it('neutral cities cannot produce', () => {
    const city = makeCity(0, 'neutral', 200, 200);
    city.productionQueue.push({ kind: 'light', progress: 0, rallyPoint: null });
    const state = makeState([], [city]);
    const hash = new SpatialHash<Unit>();

    stepEconomy(state, hash, E.SPAWN_TIME + 1);
    expect(state.units.length).toBe(0);
  });
});
