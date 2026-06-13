// Path-order input: resample a freehand stroke into evenly-spaced waypoints,
// and capture a path-draw gesture. resamplePath is pure and exported for tests.

import type { Vec2 } from '../core/state';

/**
 * Re-sample a polyline so consecutive points are ≤ `spacing` px apart.
 * The first and last points of the input are always preserved.
 */
export function resamplePath(points: readonly Vec2[], spacing: number): Vec2[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0]!.x, y: points[0]!.y }];

  const result: Vec2[] = [{ x: points[0]!.x, y: points[0]!.y }];
  let carry = 0; // distance already "used up" within the current segment

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-9) continue;

    let walked = spacing - carry;
    while (walked <= segLen) {
      const t = walked / segLen;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      walked += spacing;
    }
    // carry = how far into the next segment we'd start
    carry = segLen - (walked - spacing);
  }

  // Always include the final point if it's not already there.
  const last = points[points.length - 1]!;
  const tail = result[result.length - 1]!;
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > 1e-6) {
    result.push({ x: last.x, y: last.y });
  }

  return result;
}

/** Accumulates a freehand path stroke from world-space pointer events. */
export class PathCapture {
  private raw: Vec2[] = [];
  private _active = false;

  get isActive(): boolean { return this._active; }
  get rawPath(): readonly Vec2[] { return this.raw; }

  begin(wx: number, wy: number): void {
    this._active = true;
    this.raw = [{ x: wx, y: wy }];
  }

  move(wx: number, wy: number): void {
    if (!this._active) return;
    const last = this.raw[this.raw.length - 1]!;
    if (Math.hypot(wx - last.x, wy - last.y) >= 4) {
      this.raw.push({ x: wx, y: wy });
    }
  }

  /** Finish and return resampled waypoints, or null if the path is too short. */
  end(spacing: number): Vec2[] | null {
    this._active = false;
    const raw = this.raw;
    this.raw = [];
    if (raw.length < 2) return null;
    const wps = resamplePath(raw, spacing);
    return wps.length >= 1 ? wps : null;
  }

  cancel(): void {
    this._active = false;
    this.raw = [];
  }
}
