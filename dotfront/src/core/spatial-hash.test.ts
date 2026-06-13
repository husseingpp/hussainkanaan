import { describe, expect, it } from 'vitest';
import { SpatialHash } from './spatial-hash';

interface P {
  id: number;
  pos: { x: number; y: number };
}

function pt(id: number, x: number, y: number): P {
  return { id, pos: { x, y } };
}

describe('SpatialHash.queryRadius', () => {
  it('returns exactly the in-range items on a synthetic layout', () => {
    const hash = new SpatialHash<P>(28);
    const items = [pt(0, 0, 0), pt(1, 10, 0), pt(2, 100, 0), pt(3, 0, 200)];
    hash.rebuild(items);

    const ids = hash
      .queryRadius(0, 0, 15)
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual([0, 1]);
  });

  it('uses true circular distance, not the cell bounding box', () => {
    const hash = new SpatialHash<P>(10);
    // Diagonally placed point ~14.1px away is outside radius 12 even though it
    // shares a neighboring cell region.
    hash.rebuild([pt(0, 0, 0), pt(1, 10, 10)]);
    expect(hash.queryRadius(0, 0, 12).map((p) => p.id)).toEqual([0]);
    expect(
      hash
        .queryRadius(0, 0, 15)
        .map((p) => p.id)
        .sort(),
    ).toEqual([0, 1]);
  });

  it('finds neighbors straddling a cell boundary', () => {
    const hash = new SpatialHash<P>(10);
    // x=9 and x=11 fall in adjacent cells but are only 2px apart.
    hash.rebuild([pt(0, 9, 5), pt(1, 11, 5)]);
    expect(hash.queryRadius(9, 5, 5).map((p) => p.id).sort()).toEqual([0, 1]);
  });

  it('handles negative coordinates', () => {
    const hash = new SpatialHash<P>(10);
    hash.rebuild([pt(0, -50, -50), pt(1, -45, -50), pt(2, 50, 50)]);
    expect(hash.queryRadius(-50, -50, 8).map((p) => p.id).sort()).toEqual([0, 1]);
  });

  it('reuses the out array and clears prior contents', () => {
    const hash = new SpatialHash<P>(10);
    hash.rebuild([pt(0, 0, 0)]);
    const out: P[] = [pt(99, 999, 999)];
    const result = hash.queryRadius(0, 0, 5, out);
    expect(result).toBe(out);
    expect(out.map((p) => p.id)).toEqual([0]);
  });

  it('reports occupancy per occupied cell', () => {
    const hash = new SpatialHash<P>(10);
    hash.rebuild([pt(0, 1, 1), pt(1, 2, 2), pt(2, 50, 50)]);
    const occ = hash.occupancy().sort((a, b) => b.count - a.count);
    expect(occ).toHaveLength(2);
    expect(occ[0]!.count).toBe(2);
    expect(occ[1]!.count).toBe(1);
  });
});
