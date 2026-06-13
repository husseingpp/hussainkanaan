import { describe, expect, it } from 'vitest';
import {
  Terrain,
  damageMul,
  getCell,
  isLandType,
  isPassable,
  landReachable,
  makeGrid,
  setCell,
  speedMul,
  terrainAt,
} from './terrain';
import { UNIT_TYPES } from './unit-types';

const infantry = UNIT_TYPES.infantry;
const tank     = UNIT_TYPES.tank;
const drone    = UNIT_TYPES.drone;

describe('terrain modifiers', () => {
  it('tanks are slower than infantry in forest and hills', () => {
    expect(speedMul(Terrain.Forest, tank)).toBeCloseTo(0.5);
    expect(speedMul(Terrain.Forest, infantry)).toBeCloseTo(0.75);
    expect(speedMul(Terrain.Hills, tank)).toBeCloseTo(0.6);
    expect(speedMul(Terrain.Hills, infantry)).toBeCloseTo(0.8);
  });

  it('both infantry and tanks are slowed in water', () => {
    expect(speedMul(Terrain.Water, infantry)).toBeLessThan(1);
    expect(speedMul(Terrain.Water, tank)).toBeLessThan(1);
  });

  it('mountains are impassable (zero speed)', () => {
    expect(speedMul(Terrain.Mountain, infantry)).toBe(0);
    expect(speedMul(Terrain.Mountain, tank)).toBe(0);
  });

  it('drones ignore terrain speed (flying) except mountains', () => {
    expect(speedMul(Terrain.Forest, drone)).toBe(1);
    expect(speedMul(Terrain.Water, drone)).toBe(1);
    expect(speedMul(Terrain.Mountain, drone)).toBe(0);
  });

  it('tank damage is cut in forest; infantry less so', () => {
    expect(damageMul(Terrain.Forest, tank)).toBeCloseTo(0.6);
    expect(damageMul(Terrain.Plains, tank)).toBe(1.0);
    expect(damageMul(Terrain.Forest, infantry)).toBeCloseTo(0.8);
  });
});

describe('grid sampling', () => {
  it('reads cells by world coordinate', () => {
    const grid = makeGrid(4, 4, 32);
    setCell(grid, 1, 1, Terrain.Water);
    expect(terrainAt(grid, 40, 40)).toBe(Terrain.Water); // cell (1,1)
    expect(terrainAt(grid, 0, 0)).toBe(Terrain.Plains);
  });

  it('treats out-of-bounds as an impassable wall', () => {
    const grid = makeGrid(4, 4, 32);
    expect(getCell(grid, -1, 0)).toBe(Terrain.Mountain);
    expect(isPassable(grid, -10, -10)).toBe(false);
    expect(isPassable(grid, 10, 10)).toBe(true);
  });

  it('isLandType excludes water and mountain', () => {
    expect(isLandType(Terrain.Plains)).toBe(true);
    expect(isLandType(Terrain.Forest)).toBe(true);
    expect(isLandType(Terrain.Hills)).toBe(true);
    expect(isLandType(Terrain.Water)).toBe(false);
    expect(isLandType(Terrain.Mountain)).toBe(false);
  });
});

describe('landReachable (flood fill)', () => {
  it('finds a path across all-land grid', () => {
    const grid = makeGrid(5, 5, 32); // all plains
    expect(landReachable(grid, 0, 0, 4, 4)).toBe(true);
  });

  it('reports no path when a wall of water splits the grid', () => {
    const grid = makeGrid(5, 5, 32);
    // Fill column 2 entirely with water — splits left from right.
    for (let row = 0; row < 5; row++) setCell(grid, 2, row, Terrain.Water);
    expect(landReachable(grid, 0, 0, 4, 4)).toBe(false);
  });

  it('finds a path around a partial wall', () => {
    const grid = makeGrid(5, 5, 32);
    // Water in column 2 except a gap at row 0 → reachable around the top.
    for (let row = 1; row < 5; row++) setCell(grid, 2, row, Terrain.Water);
    expect(landReachable(grid, 0, 4, 4, 4)).toBe(true);
  });

  it('returns false if the start or target is not land', () => {
    const grid = makeGrid(5, 5, 32);
    setCell(grid, 0, 0, Terrain.Mountain);
    expect(landReachable(grid, 0, 0, 4, 4)).toBe(false);
  });
});
