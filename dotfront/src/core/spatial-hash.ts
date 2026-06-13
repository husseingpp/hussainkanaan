// Spatial hash grid — THE performance lever (BLUEPRINT.md §4). Rebuilt each
// sim tick; every proximity query (separation now; combat targeting, healing,
// capture later) goes through queryRadius. Never O(n²) over units.

import { CONFIG } from '../config';
import type { Vec2 } from './state';

interface HasPos {
  pos: Vec2;
}

// Cell coords are packed into one integer key. The offset keeps keys positive
// for any world position within ±32k cells of the origin.
const KEY_OFFSET = 32768;
const KEY_STRIDE = 65536;

function packKey(cx: number, cy: number): number {
  return (cy + KEY_OFFSET) * KEY_STRIDE + (cx + KEY_OFFSET);
}

export class SpatialHash<T extends HasPos> {
  private readonly cells = new Map<number, T[]>();
  // Cell arrays are pooled across rebuilds to avoid per-tick allocation churn.
  private readonly pool: T[][] = [];

  constructor(readonly cellSize: number = CONFIG.SPATIAL_CELL_SIZE) {}

  cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  rebuild(items: readonly T[]): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.cells.clear();

    for (const item of items) {
      const key = packKey(this.cellCoord(item.pos.x), this.cellCoord(item.pos.y));
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = this.pool.pop() ?? [];
        this.cells.set(key, bucket);
      }
      bucket.push(item);
    }
  }

  /**
   * Collect all items within `radius` of (x, y) into `out` (cleared first).
   * Pass a reused array from hot loops to avoid allocation.
   */
  queryRadius(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const r2 = radius * radius;
    const minCx = this.cellCoord(x - radius);
    const maxCx = this.cellCoord(x + radius);
    const minCy = this.cellCoord(y - radius);
    const maxCy = this.cellCoord(y + radius);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(packKey(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          const dx = item.pos.x - x;
          const dy = item.pos.y - y;
          if (dx * dx + dy * dy <= r2) out.push(item);
        }
      }
    }
    return out;
  }

  /** Occupied cells with counts — for the H debug overlay. */
  occupancy(): { cx: number; cy: number; count: number }[] {
    const result: { cx: number; cy: number; count: number }[] = [];
    for (const [key, bucket] of this.cells) {
      if (bucket.length === 0) continue;
      const cx = (key % KEY_STRIDE) - KEY_OFFSET;
      const cy = Math.floor(key / KEY_STRIDE) - KEY_OFFSET;
      result.push({ cx, cy, count: bucket.length });
    }
    return result;
  }
}
