// Terrain grid + per-type modifiers (BLUEPRINT.md §5.4). Pure: lookup tables
// and grid sampling only, no DOM/canvas. Terrain codes are numeric so the grid
// can be a Uint8Array (typed array, §8).

import type { UnitTypeDef } from './unit-types';

export const Terrain = {
  Plains: 0,
  Forest: 1,
  Hills: 2,
  Water: 3,
  Mountain: 4,
} as const;

export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

export interface TerrainGrid {
  cols: number;
  rows: number;
  cellSize: number;
  /** Row-major terrain codes, length cols*rows. */
  cells: Uint8Array;
}

export function makeGrid(cols: number, rows: number, cellSize: number): TerrainGrid {
  return { cols, rows, cellSize, cells: new Uint8Array(cols * rows) };
}

export function getCell(grid: TerrainGrid, col: number, row: number): TerrainType {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return Terrain.Mountain;
  return grid.cells[row * grid.cols + col] as TerrainType;
}

export function setCell(grid: TerrainGrid, col: number, row: number, t: TerrainType): void {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return;
  grid.cells[row * grid.cols + col] = t;
}

/** Terrain type at a world-space point. Out of bounds reads as Mountain (wall). */
export function terrainAt(grid: TerrainGrid, x: number, y: number): TerrainType {
  return getCell(grid, Math.floor(x / grid.cellSize), Math.floor(y / grid.cellSize));
}

/** Mountains (and out-of-bounds) block movement; everything else is passable. */
export function isPassable(grid: TerrainGrid, x: number, y: number): boolean {
  return terrainAt(grid, x, y) !== Terrain.Mountain;
}

/** "Land" for connectivity = plains, forest, or hills (not water/mountain). */
export function isLandType(t: TerrainType): boolean {
  return t === Terrain.Plains || t === Terrain.Forest || t === Terrain.Hills;
}

export function speedMul(t: TerrainType, def: UnitTypeDef): number {
  if (def.flying) return t === Terrain.Mountain ? 0 : 1;
  return def.terrainSpeed[t] ?? 0;
}

export function damageMul(t: TerrainType, def: UnitTypeDef): number {
  return def.terrainDamage[t] ?? 1;
}

/**
 * Breadth-first search over land cells: is (tCol, tRow) reachable from
 * (sCol, sRow) walking only across plains/forest/hills (4-connected)?
 * This is the connectivity check that validates generated maps.
 */
export function landReachable(
  grid: TerrainGrid,
  sCol: number,
  sRow: number,
  tCol: number,
  tRow: number,
): boolean {
  const { cols, rows } = grid;
  if (!isLandType(getCell(grid, sCol, sRow)) || !isLandType(getCell(grid, tCol, tRow))) {
    return false;
  }
  const visited = new Uint8Array(cols * rows);
  // Flat queue of cell indices; avoids per-step array allocation.
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  const start = sRow * cols + sCol;
  visited[start] = 1;
  queue[tail++] = start;

  while (head < tail) {
    const idx = queue[head++]!;
    const col = idx % cols;
    const row = (idx - col) / cols;
    if (col === tCol && row === tRow) return true;

    // 4-connected neighbours.
    const neighbours = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [nc, nr] of neighbours) {
      if (nc! < 0 || nr! < 0 || nc! >= cols || nr! >= rows) continue;
      const nIdx = nr! * cols + nc!;
      if (visited[nIdx]) continue;
      if (!isLandType(grid.cells[nIdx] as TerrainType)) continue;
      visited[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return false;
}
