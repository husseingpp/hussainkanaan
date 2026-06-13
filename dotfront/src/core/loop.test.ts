import { describe, expect, it } from 'vitest';
import { FixedTimestepAccumulator } from './loop';

// 50ms tick, cap 5 ticks/frame, clamp frames at 250ms (the CONFIG defaults).
function acc(): FixedTimestepAccumulator {
  return new FixedTimestepAccumulator(50, 5, 250);
}

describe('FixedTimestepAccumulator', () => {
  it('runs no ticks until a full timestep elapses', () => {
    const a = acc();
    expect(a.advance(20).ticks).toBe(0);
    const r = a.advance(40); // 60ms accumulated → one tick, 10ms remainder
    expect(r.ticks).toBe(1);
    expect(r.alpha).toBeCloseTo(0.2, 5);
  });

  it('runs multiple ticks for a large frame', () => {
    expect(acc().advance(160).ticks).toBe(3); // 160ms / 50 = 3 ticks
  });

  it('keeps alpha within [0, 1)', () => {
    const a = acc();
    for (const dt of [13, 7, 50, 99, 1, 33]) {
      const { alpha } = a.advance(dt);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('caps ticks per frame and drops the backlog (no death spiral)', () => {
    // 1000ms would be 20 ticks; capped at 5, and the leftover is not carried.
    const r = acc().advance(1000);
    expect(r.ticks).toBe(5);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThan(1);
  });

  it('clamps absurd/negative frame deltas', () => {
    expect(acc().advance(-100).ticks).toBe(0);
    // 10_000ms is clamped to 250ms → 5 ticks.
    expect(acc().advance(10_000).ticks).toBe(5);
  });
});
