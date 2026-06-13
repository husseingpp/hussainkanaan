// Freehand lasso selection: point-in-polygon test + drag-capture class.
// pointInPolygon is a pure function — exported for unit tests.

import type { Vec2 } from '../core/state';

/** Ray-casting point-in-polygon (handles concave polygons and self-intersections). */
export function pointInPolygon(px: number, py: number, poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Accumulates a freehand lasso polygon from world-space pointer events. */
export class LassoCapture {
  private points: Vec2[] = [];
  private _active = false;

  get isActive(): boolean { return this._active; }
  get polygon(): readonly Vec2[] { return this.points; }

  begin(wx: number, wy: number): void {
    this._active = true;
    this.points = [{ x: wx, y: wy }];
  }

  /** Add a point only if the pointer has moved enough (avoids duplicate noise). */
  move(wx: number, wy: number): void {
    if (!this._active) return;
    const last = this.points[this.points.length - 1]!;
    if (Math.hypot(wx - last.x, wy - last.y) >= 4) {
      this.points.push({ x: wx, y: wy });
    }
  }

  /** Finish the lasso and return the completed polygon (or null if too short). */
  end(): Vec2[] | null {
    this._active = false;
    const poly = this.points.length >= 3 ? this.points.slice() : null;
    this.points = [];
    return poly;
  }

  cancel(): void {
    this._active = false;
    this.points = [];
  }
}
