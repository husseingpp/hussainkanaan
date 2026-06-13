import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { generateMap } from './mapgen';
import { isLandType, landReachable, terrainAt } from './terrain';

function cellOf(x: number, y: number, cellSize: number): [number, number] {
  return [Math.floor(x / cellSize), Math.floor(y / cellSize)];
}

describe('generateMap', () => {
  it('produces a valid, connected map for 10 different seeds (M2 gate)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { grid, cities } = generateMap(seed);

      const capitals = cities.filter((c) => c.isCapital);
      expect(capitals).toHaveLength(2);
      const player = capitals.find((c) => c.owner === 'player')!;
      const enemy = capitals.find((c) => c.owner === 'enemy')!;
      expect(player).toBeDefined();
      expect(enemy).toBeDefined();

      // Capitals sit on land and at opposite ends.
      expect(isLandType(terrainAt(grid, player.pos.x, player.pos.y))).toBe(true);
      expect(isLandType(terrainAt(grid, enemy.pos.x, enemy.pos.y))).toBe(true);
      expect(player.pos.x).toBeLessThan(enemy.pos.x);

      // Both capitals reachable over land.
      const [pc, pr] = cellOf(player.pos.x, player.pos.y, grid.cellSize);
      const [ec, er] = cellOf(enemy.pos.x, enemy.pos.y, grid.cellSize);
      expect(landReachable(grid, pc, pr, ec, er)).toBe(true);

      // Enough cities, all reasonably spaced.
      expect(cities.length).toBeGreaterThanOrEqual(2 + CONFIG.MAP.MIN_NEUTRAL_CITIES);
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          const d = Math.hypot(
            cities[i]!.pos.x - cities[j]!.pos.x,
            cities[i]!.pos.y - cities[j]!.pos.y,
          );
          expect(d).toBeGreaterThanOrEqual(CONFIG.MAP.CITY_SPACING - 1e-6);
        }
      }
    }
  });

  it('is deterministic: same seed yields the same map', () => {
    const a = generateMap(42);
    const b = generateMap(42);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
    expect(a.cities.map((c) => c.pos)).toEqual(b.cities.map((c) => c.pos));
  });

  it('different seeds yield different terrain', () => {
    const a = generateMap(1);
    const b = generateMap(2);
    expect(Array.from(a.grid.cells)).not.toEqual(Array.from(b.grid.cells));
  });
});
