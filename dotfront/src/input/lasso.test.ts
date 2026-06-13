import { describe, expect, it } from 'vitest';
import { pointInPolygon } from './lasso';

// Helpers
const square = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const triangle = [
  { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 },
];

describe('pointInPolygon', () => {
  it('detects a point clearly inside a square', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });

  it('rejects a point clearly outside a square', () => {
    expect(pointInPolygon(15, 15, square)).toBe(false);
    expect(pointInPolygon(-1, 5, square)).toBe(false);
  });

  it('works on a triangle', () => {
    expect(pointInPolygon(10, 5, triangle)).toBe(true);
    expect(pointInPolygon(0, 19, triangle)).toBe(false);
  });

  it('returns false for degenerate polygons (< 3 vertices)', () => {
    expect(pointInPolygon(1, 1, [])).toBe(false);
    expect(pointInPolygon(1, 1, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
  });

  it('works for an L-shaped concave polygon', () => {
    const l = [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 },
      { x: 10, y: 10 }, { x: 10, y: 20 }, { x: 0, y: 20 },
    ];
    expect(pointInPolygon(5, 5, l)).toBe(true);    // top-left arm
    expect(pointInPolygon(5, 15, l)).toBe(true);   // bottom-left arm
    expect(pointInPolygon(15, 15, l)).toBe(false); // notch (outside)
  });

  it('handles a point on the far right boundary correctly', () => {
    // The exact boundary is implementation-defined; just verify no crash.
    expect(typeof pointInPolygon(10, 5, square)).toBe('boolean');
  });
});
