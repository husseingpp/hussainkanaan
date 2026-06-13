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

describe('terrain modifiers', () => {
  it('heavy units are slowed in forest and hills, light are not', () => {
    expect(speedMul(Terrain.Forest, true)).toBe(0.5);
    expect(speedMul(Terrain.Forest, false)).toBe(1);
    expect(speedMul(Terrain.Hills, true)).toBe(0.5);
    expect(speedMul(Terrain.Hills, false)).toBe(1);
  });

  it('both unit types are slowed in water', () => {
    expect(speedMul(Terrain.Water, false)).toBe(0.5);
    expect(speedMul(Terrain.Water, true)).toBe(0.5);
  });

  it('mountains are impassable (zero speed)', () => {
    expect(speedMul(Terrain.Mountain, false)).toBe(0);
    expect(speedMul(Terrain.Mountain, true)).toBe(0);
  });

  it('heavy damage is cut in forest/hills (§5.4)', () => {
    expect(damageMul(Terrain.Forest, true)).toBeCloseTo(0.4);
    expect(damageMul(Terrain.Plains, true)).toBe(1);
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
