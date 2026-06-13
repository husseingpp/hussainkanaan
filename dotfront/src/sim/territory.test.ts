import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { makeUnit, type City, type GameState, type Unit } from '../core/state';
import { computeTerritories } from './territory';
import { Terrain, makeGrid, setCell, type TerrainGrid, type TerrainType } from './terrain';

const T = CONFIG.TERRITORY;
const E = CONFIG.ECONOMY;

function uniformGrid(t: TerrainType = Terrain.Plains): TerrainGrid {
  const cols = Math.ceil(CONFIG.WORLD.WIDTH / CONFIG.TERRAIN.CELL_SIZE);
  const rows = Math.ceil(CONFIG.WORLD.HEIGHT / CONFIG.TERRAIN.CELL_SIZE);
  const grid = makeGrid(cols, rows, CONFIG.TERRAIN.CELL_SIZE);
  grid.cells.fill(t);
  return grid;
}

function makeCity(id: number, owner: City['owner'], x: number, y: number): City {
  return {
    id, owner, pos: { x, y }, radius: CONFIG.MAP.CITY_RADIUS, isCapital: false,
    captureProgress: 0, captureBy: null, productionQueue: [],
  };
}

function makeState(units: Unit[], cities: City[], terrain?: TerrainGrid): GameState {
  return {
    tick: 0,
    rng: () => 0.5,
    units,
    cities,
    terrain: terrain ?? uniformGrid(),
    world: { width: CONFIG.WORLD.WIDTH, height: CONFIG.WORLD.HEIGHT },
    money: { player: 0, enemy: 0 },
    territory: null,
  };
}

// ── basic ownership ───────────────────────────────────────────────────────────

describe('territory ownership', () => {
  it('a player unit marks nearby cells as player territory', () => {
    const u = makeUnit('player', 'light', 200, 200);
    const state = makeState([u], []);
    const t = computeTerritories(state);

    // The cell containing the unit should be player territory.
    const col = Math.floor(200 / T.CELL_SIZE);
    const row = Math.floor(200 / T.CELL_SIZE);
    expect(t.ownership[row * t.cols + col]).toBe(1); // PLAYER
  });

  it('an enemy unit marks cells as enemy territory', () => {
    const u = makeUnit('enemy', 'light', 800, 600);
    const state = makeState([u], []);
    const t = computeTerritories(state);

    const col = Math.floor(800 / T.CELL_SIZE);
    const row = Math.floor(600 / T.CELL_SIZE);
    expect(t.ownership[row * t.cols + col]).toBe(2); // ENEMY
  });

  it('overlapping units from both sides mark cells contested', () => {
    const p = makeUnit('player', 'light', 400, 400);
    const e = makeUnit('enemy', 'light', 400, 400);
    const state = makeState([p, e], []);
    const t = computeTerritories(state);

    const col = Math.floor(400 / T.CELL_SIZE);
    const row = Math.floor(400 / T.CELL_SIZE);
    // Cell contains both → contested (3).
    expect(t.ownership[row * t.cols + col]).toBe(3); // CONTESTED
  });

  it('dead units do not create territory', () => {
    const u = makeUnit('player', 'light', 300, 300);
    u.hp = 0;
    const state = makeState([u], []);
    const t = computeTerritories(state);

    const col = Math.floor(300 / T.CELL_SIZE);
    const row = Math.floor(300 / T.CELL_SIZE);
    expect(t.ownership[row * t.cols + col]).toBe(0); // NEUTRAL
  });

  it('cities anchor territory even with no units', () => {
    const city = makeCity(0, 'player', 1200, 800);
    const state = makeState([], [city]);
    const t = computeTerritories(state);

    const col = Math.floor(1200 / T.CELL_SIZE);
    const row = Math.floor(800 / T.CELL_SIZE);
    expect(t.ownership[row * t.cols + col]).toBe(1); // PLAYER
  });
});

// ── region detection ──────────────────────────────────────────────────────────

describe('region detection', () => {
  it('a unit connected to a city region is NOT a pocket', () => {
    // City at (500, 500); unit at (500, 500) — same cell, same region.
    const city = makeCity(0, 'player', 500, 500);
    const u = makeUnit('player', 'light', 500, 500);
    const state = makeState([u], [city]);
    const t = computeTerritories(state);

    const col = Math.floor(500 / T.CELL_SIZE);
    const row = Math.floor(500 / T.CELL_SIZE);
    const rId = t.playerMap[row * t.cols + col]!;
    expect(rId).toBeGreaterThanOrEqual(0);
    expect(t.regions[rId]!.isPocket).toBe(false);
    expect(t.regions[rId]!.supplyCapacity).toBe(E.SUPPLY_PER_CITY);
  });

  it('an isolated unit far from any city IS a pocket', () => {
    // City near left edge; unit near right edge (far apart).
    const city = makeCity(0, 'player', 100, 800);
    const u = makeUnit('player', 'light', 2300, 800); // >2000px away
    const state = makeState([u], [city]);
    const t = computeTerritories(state);

    const col = Math.floor(2300 / T.CELL_SIZE);
    const row = Math.floor(800 / T.CELL_SIZE);
    const rId = t.playerMap[row * t.cols + col]!;
    expect(rId).toBeGreaterThanOrEqual(0);
    const region = t.regions[rId]!;
    // This region has no city → pocket, zero capacity.
    expect(region.isPocket).toBe(true);
    expect(region.supplyCapacity).toBe(0);
  });

  it('a region with two cities has doubled supply capacity', () => {
    const cityA = makeCity(0, 'player', 400, 400);
    const cityB = makeCity(1, 'player', 500, 400); // close enough to share a region
    const u = makeUnit('player', 'light', 450, 400);
    const state = makeState([u], [cityA, cityB]);
    const t = computeTerritories(state);

    const col = Math.floor(450 / T.CELL_SIZE);
    const row = Math.floor(400 / T.CELL_SIZE);
    const rId = t.playerMap[row * t.cols + col]!;
    expect(rId).toBeGreaterThanOrEqual(0);
    // Both cities in same region → capacity = 2 × SUPPLY_PER_CITY.
    expect(t.regions[rId]!.supplyCapacity).toBe(2 * E.SUPPLY_PER_CITY);
  });
});

// ── mountain blocking ─────────────────────────────────────────────────────────

describe('mountain blocking', () => {
  it('a column of mountains splits two player units into separate regions', () => {
    // Build a terrain with a full column of mountains in the middle.
    const terrainCols = Math.ceil(CONFIG.WORLD.WIDTH / CONFIG.TERRAIN.CELL_SIZE);
    const terrainRows = Math.ceil(CONFIG.WORLD.HEIGHT / CONFIG.TERRAIN.CELL_SIZE);
    const grid = makeGrid(terrainCols, terrainRows, CONFIG.TERRAIN.CELL_SIZE);

    // Stamp a mountain column at world x=1200 (terrain col 37 at cellSize=32).
    const midCol = Math.floor(1200 / CONFIG.TERRAIN.CELL_SIZE);
    for (let r = 0; r < terrainRows; r++) setCell(grid, midCol, r, Terrain.Mountain);

    const left = makeUnit('player', 'light', 1000, 800);
    const right = makeUnit('player', 'light', 1400, 800);
    const state = makeState([left, right], [], grid);
    const t = computeTerritories(state);

    const lCol = Math.floor(1000 / T.CELL_SIZE);
    const rCol = Math.floor(1400 / T.CELL_SIZE);
    const row = Math.floor(800 / T.CELL_SIZE);

    const lRegion = t.playerMap[row * t.cols + lCol]!;
    const rRegion = t.playerMap[row * t.cols + rCol]!;

    // Units on opposite sides of the mountain wall must be in different regions.
    expect(lRegion).not.toBe(rRegion);
    // And both regions should be pockets (no city in either).
    expect(t.regions[lRegion]!.isPocket).toBe(true);
    expect(t.regions[rRegion]!.isPocket).toBe(true);
  });
});
