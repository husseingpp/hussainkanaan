// Territory & encirclement (BLUEPRINT.md §5.6). Pure: no DOM/canvas/
// Date.now/Math.random. Runs every STAGGER ticks (≈1s) in simulate.ts.
//
// Algorithm: for each player, mark every coarse cell (CELL_SIZE=64px) whose
// centre is within REACH (80px) of any friendly unit or city as an "anchor".
// Mountain cells are always excluded. Then BFS the anchor cells to find
// connected components (regions). A region without a friendly city = pocket
// (zero supply). The economy step uses region supply to power starvation.

import { CONFIG } from '../config';
import type { GameState, TerritoryData, TerritoryRegion } from '../core/state';
import { Terrain, terrainAt } from './terrain';

const PLAYER = 1;
const ENEMY = 2;
const CONTESTED = 3;

const T = CONFIG.TERRITORY;
const searchR = Math.ceil(T.REACH / T.CELL_SIZE) + 1;
const reach2 = T.REACH * T.REACH;

/** Flood-fill queue reused across calls to avoid GC pressure. */
const queue: number[] = [];

function markAnchors(
  x: number,
  y: number,
  state: GameState,
  mask: Uint8Array,
  cols: number,
  rows: number,
): void {
  const cc = Math.floor(x / T.CELL_SIZE);
  const cr = Math.floor(y / T.CELL_SIZE);
  const rMin = Math.max(0, cr - searchR);
  const rMax = Math.min(rows - 1, cr + searchR);
  const cMin = Math.max(0, cc - searchR);
  const cMax = Math.min(cols - 1, cc + searchR);

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const cx = (c + 0.5) * T.CELL_SIZE;
      const cy = (r + 0.5) * T.CELL_SIZE;
      if (terrainAt(state.terrain, cx, cy) === Terrain.Mountain) continue;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy <= reach2) mask[r * cols + c] = 1;
    }
  }
}

export function computeTerritories(state: GameState): TerritoryData {
  const cellSize = T.CELL_SIZE;
  const cols = Math.ceil(state.world.width / cellSize);
  const rows = Math.ceil(state.world.height / cellSize);
  const n = cols * rows;

  const playerAnchor = new Uint8Array(n);
  const enemyAnchor = new Uint8Array(n);

  // Mark anchor cells from units (alive only).
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    if (u.owner === 'player') markAnchors(u.pos.x, u.pos.y, state, playerAnchor, cols, rows);
    else if (u.owner === 'enemy') markAnchors(u.pos.x, u.pos.y, state, enemyAnchor, cols, rows);
  }
  // Mark anchor cells from cities (cities are strong anchors regardless of unit density).
  for (const city of state.cities) {
    if (city.owner === 'player') markAnchors(city.pos.x, city.pos.y, state, playerAnchor, cols, rows);
    else if (city.owner === 'enemy') markAnchors(city.pos.x, city.pos.y, state, enemyAnchor, cols, rows);
  }

  // Build ownership grid.
  const ownership = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (playerAnchor[i] && enemyAnchor[i]) ownership[i] = CONTESTED;
    else if (playerAnchor[i]) ownership[i] = PLAYER;
    else if (enemyAnchor[i]) ownership[i] = ENEMY;
    // else NEUTRAL (0)
  }

  // Flood-fill connected components; player and enemy share a global region ID space.
  const playerMap = new Int16Array(n).fill(-1);
  const enemyMap = new Int16Array(n).fill(-1);
  const regions: TerritoryRegion[] = [];

  for (const owner of ['player', 'enemy'] as const) {
    const anchor = owner === 'player' ? playerAnchor : enemyAnchor;
    const regionMap = owner === 'player' ? playerMap : enemyMap;
    const visited = new Uint8Array(n);

    for (let start = 0; start < n; start++) {
      if (!anchor[start] || visited[start]) continue;

      const regionId = regions.length;
      queue.length = 0;
      queue.push(start);
      visited[start] = 1;
      regionMap[start] = regionId;
      let head = 0;

      while (head < queue.length) {
        const curr = queue[head++]!;
        const c = curr % cols;
        const r = Math.floor(curr / cols);

        // Expand to 4-connected passable anchor neighbours.
        if (c > 0) tryEnqueue(curr - 1, anchor, visited, regionMap, regionId, queue);
        if (c < cols - 1) tryEnqueue(curr + 1, anchor, visited, regionMap, regionId, queue);
        if (r > 0) tryEnqueue(curr - cols, anchor, visited, regionMap, regionId, queue);
        if (r < rows - 1) tryEnqueue(curr + cols, anchor, visited, regionMap, regionId, queue);
      }

      regions.push({ id: regionId, owner, isPocket: true, supplyCapacity: 0 });
    }
  }

  // Assign city supply to their host region.
  for (const city of state.cities) {
    if (city.owner === 'neutral') continue;
    const col = Math.min(Math.max(Math.floor(city.pos.x / cellSize), 0), cols - 1);
    const row = Math.min(Math.max(Math.floor(city.pos.y / cellSize), 0), rows - 1);
    const idx = row * cols + col;
    const rId = (city.owner === 'player' ? playerMap[idx] : enemyMap[idx]) ?? -1;
    if (rId < 0) continue;
    const region = regions[rId];
    if (!region || region.owner !== city.owner) continue;
    region.isPocket = false;
    region.supplyCapacity += CONFIG.ECONOMY.SUPPLY_PER_CITY;
  }

  return { cols, rows, cellSize, ownership, playerMap, enemyMap, regions };
}

function tryEnqueue(
  nb: number,
  anchor: Uint8Array,
  visited: Uint8Array,
  regionMap: Int16Array,
  regionId: number,
  q: number[],
): void {
  if (anchor[nb] && !visited[nb]) {
    visited[nb] = 1;
    regionMap[nb] = regionId;
    q.push(nb);
  }
}
