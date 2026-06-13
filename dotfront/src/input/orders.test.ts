import { describe, expect, it } from 'vitest';
import { resamplePath } from './orders';

describe('resamplePath', () => {
  it('returns a single point for a single-point input', () => {
    const r = resamplePath([{ x: 5, y: 5 }], 10);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ x: 5, y: 5 });
  });

  it('returns an empty array for an empty input', () => {
    expect(resamplePath([], 10)).toHaveLength(0);
  });

  it('places evenly-spaced waypoints along a straight horizontal line', () => {
    // 100px line with spacing 20 → first point at 0, then 20, 40, 60, 80, final at 100
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const r = resamplePath(pts, 20);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[r.length - 1]).toEqual({ x: 100, y: 0 });
    // Interior spacing should be ≈ 20
    for (let i = 1; i < r.length; i++) {
      const d = Math.hypot(r[i]!.x - r[i - 1]!.x, r[i]!.y - r[i - 1]!.y);
      expect(d).toBeLessThanOrEqual(20 + 1e-6);
    }
  });

  it('preserves the final point of a multi-segment path', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 },
    ];
    const r = resamplePath(pts, 20);
    const last = r[r.length - 1]!;
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(50);
  });

  it('handles a spacing larger than the total path length', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
    const r = resamplePath(pts, 20);
    // Should contain at least the start and end
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[r.length - 1]!.x).toBeCloseTo(5);
  });

  it('handles a diagonal path correctly', () => {
    // 45° line, length = 100√2 ≈ 141.4px, spacing 10 → ~14 interior + endpoints
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const r = resamplePath(pts, 10);
    expect(r.length).toBeGreaterThan(5);
    // Each consecutive pair should be ≤ spacing apart
    for (let i = 1; i < r.length; i++) {
      const d = Math.hypot(r[i]!.x - r[i - 1]!.x, r[i]!.y - r[i - 1]!.y);
      expect(d).toBeLessThanOrEqual(10 + 1e-6);
    }
  });
});
