// Pre-render the terrain grid to an offscreen canvas once per map (BLUEPRINT.md
// §4, §8). The canvas is world-sized (1px = 1 world unit) so the renderer can
// blit it under the camera transform with a single drawImage.

import { CONFIG } from '../config';
import { Terrain, type TerrainGrid } from '../sim/terrain';

export function createTerrainCanvas(grid: TerrainGrid): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * grid.cellSize;
  canvas.height = grid.rows * grid.cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for terrain layer');

  const colors = CONFIG.COLORS.TERRAIN;
  const size = grid.cellSize;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const t = grid.cells[row * grid.cols + col]!;
      ctx.fillStyle = colors[t]!;
      // Overlap by 1px to avoid hairline seams at fractional zoom.
      ctx.fillRect(col * size, row * size, size + 1, size + 1);
    }
  }

  // Simple ridge marks on mountains so they read as walls (§7).
  ctx.strokeStyle = CONFIG.COLORS.MOUNTAIN_RIDGE;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.cells[row * grid.cols + col] !== Terrain.Mountain) continue;
      const x = col * size;
      const y = row * size;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.2, y + size * 0.7);
      ctx.lineTo(x + size * 0.5, y + size * 0.3);
      ctx.lineTo(x + size * 0.8, y + size * 0.7);
      ctx.stroke();
    }
  }

  return canvas;
}
