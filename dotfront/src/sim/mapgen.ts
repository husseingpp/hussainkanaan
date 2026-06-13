// Procedural map generation (BLUEPRINT.md §5.4): seeded fBm elevation +
// moisture → terrain classification, then city/capital placement with spacing
// constraints, validated by a land-connectivity check. Pure & deterministic:
// all randomness comes from the seeded RNG; re-rolls increment the seed.

import { CONFIG } from '../config';
import { mulberry32 } from '../core/rng';
import type { City, Vec2 } from '../core/state';
import { Noise2D } from './noise';
import {
  Terrain,
  type TerrainGrid,
  type TerrainType,
  getCell,
  isLandType,
  landReachable,
  makeGrid,
  setCell,
} from './terrain';

export interface MapData {
  grid: TerrainGrid;
  cities: City[];
  /** How many re-rolls were needed (0 = first attempt valid). */
  attempts: number;
}

function classify(elev: number, moisture: number): TerrainType {
  const m = CONFIG.MAP;
  if (elev > m.ELEV_MOUNTAIN) return Terrain.Mountain;
  if (elev > m.ELEV_HILL) return Terrain.Hills;
  if (elev < m.ELEV_WATER) return Terrain.Water;
  return moisture > m.MOISTURE_FOREST ? Terrain.Forest : Terrain.Plains;
}

function buildGrid(seed: number, cols: number, rows: number): TerrainGrid {
  const grid = makeGrid(cols, rows, CONFIG.TERRAIN.CELL_SIZE);
  const rng = mulberry32(seed);
  // Two independent noise fields for elevation and moisture.
  const elevNoise = new Noise2D(rng);
  const moistNoise = new Noise2D(rng);
  const { NOISE_FREQ, NOISE_OCTAVES, NOISE_PERSISTENCE } = CONFIG.MAP;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const e = elevNoise.fbm(col * NOISE_FREQ, row * NOISE_FREQ, NOISE_OCTAVES, NOISE_PERSISTENCE);
      const mo = moistNoise.fbm(
        col * NOISE_FREQ + 100,
        row * NOISE_FREQ + 100,
        NOISE_OCTAVES,
        NOISE_PERSISTENCE,
      );
      setCell(grid, col, row, classify(e, mo));
    }
  }
  return grid;
}

/** Stamp the city footprint to plains so it's always passable and safe (§5.4). */
function stampCity(grid: TerrainGrid, center: Vec2, radius: number): void {
  const r = Math.ceil(radius / grid.cellSize);
  const cc = Math.floor(center.x / grid.cellSize);
  const cr = Math.floor(center.y / grid.cellSize);
  for (let row = cr - r; row <= cr + r; row++) {
    for (let col = cc - r; col <= cc + r; col++) {
      if (Math.hypot(col - cc, row - cr) <= r) setCell(grid, col, row, Terrain.Plains);
    }
  }
}

function cellCenter(grid: TerrainGrid, col: number, row: number): Vec2 {
  return { x: (col + 0.5) * grid.cellSize, y: (row + 0.5) * grid.cellSize };
}

/** One generation attempt. Returns cities (with capitals) or null if invalid. */
function attempt(seed: number, cols: number, rows: number): MapData | null {
  const grid = buildGrid(seed, cols, rows);
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const m = CONFIG.MAP;

  const landCells: { col: number; row: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isLandType(getCell(grid, col, row))) landCells.push({ col, row });
    }
  }
  if (landCells.length < 50) return null;

  // Capitals: a land cell in the left/right edge bands, nearest vertical centre.
  const bandCols = Math.max(2, Math.floor(cols * m.CAPITAL_BAND));
  const leftBand = landCells.filter((c) => c.col < bandCols);
  const rightBand = landCells.filter((c) => c.col >= cols - bandCols);
  if (leftBand.length === 0 || rightBand.length === 0) return null;

  const midRow = rows / 2;
  const nearestCentre = (arr: typeof landCells) =>
    arr.reduce((best, c) => (Math.abs(c.row - midRow) < Math.abs(best.row - midRow) ? c : best));
  const playerCell = nearestCentre(leftBand);
  const enemyCell = nearestCentre(rightBand);

  if (!landReachable(grid, playerCell.col, playerCell.row, enemyCell.col, enemyCell.row)) {
    return null;
  }

  const cities: City[] = [];
  let nextId = 0;
  const addCity = (col: number, row: number, owner: City['owner'], isCapital: boolean): City => {
    const pos = cellCenter(grid, col, row);
    const city: City = {
      id: nextId++, owner, pos, radius: m.CITY_RADIUS, isCapital,
      captureProgress: 0, captureBy: null, productionQueue: [],
    };
    stampCity(grid, pos, m.CITY_RADIUS);
    cities.push(city);
    return city;
  };

  addCity(playerCell.col, playerCell.row, 'player', true);
  addCity(enemyCell.col, enemyCell.row, 'enemy', true);

  // Neutral cities via rejection sampling against the spacing constraint.
  const targetNeutral =
    m.MIN_NEUTRAL_CITIES + Math.floor(rng() * (m.MAX_NEUTRAL_CITIES - m.MIN_NEUTRAL_CITIES + 1));
  let tries = 0;
  while (cities.length - 2 < targetNeutral && tries < 4000) {
    tries++;
    const cell = landCells[Math.floor(rng() * landCells.length)]!;
    const pos = cellCenter(grid, cell.col, cell.row);
    if (cities.some((c) => Math.hypot(c.pos.x - pos.x, c.pos.y - pos.y) < m.CITY_SPACING)) continue;
    addCity(cell.col, cell.row, 'neutral', false);
  }

  // Need at least the minimum neutral count for a worthwhile map.
  if (cities.length - 2 < m.MIN_NEUTRAL_CITIES) return null;

  return { grid, cities, attempts: 0 };
}

/** Generate a validated map for `seed`, re-rolling deterministically on failure. */
export function generateMap(seed: number): MapData {
  const cols = Math.ceil(CONFIG.WORLD.WIDTH / CONFIG.TERRAIN.CELL_SIZE);
  const rows = Math.ceil(CONFIG.WORLD.HEIGHT / CONFIG.TERRAIN.CELL_SIZE);

  let lastResort: MapData | null = null;
  for (let i = 0; i <= CONFIG.MAP.MAX_REROLLS; i++) {
    const result = attempt(seed + i * 0x9e3779b1, cols, rows);
    if (result) return { ...result, attempts: i };
    lastResort = null;
  }
  // Extremely unlikely; fall back to a guaranteed-trivial all-plains map.
  if (!lastResort) {
    const grid = makeGrid(cols, rows, CONFIG.TERRAIN.CELL_SIZE); // all plains (code 0)
    const cities: City[] = [
      { id: 0, owner: 'player', pos: cellCenter(grid, 2, Math.floor(rows / 2)), radius: CONFIG.MAP.CITY_RADIUS, isCapital: true, captureProgress: 0, captureBy: null, productionQueue: [] },
      { id: 1, owner: 'enemy', pos: cellCenter(grid, cols - 3, Math.floor(rows / 2)), radius: CONFIG.MAP.CITY_RADIUS, isCapital: true, captureProgress: 0, captureBy: null, productionQueue: [] },
    ];
    lastResort = { grid, cities, attempts: CONFIG.MAP.MAX_REROLLS };
  }
  return lastResort;
}
