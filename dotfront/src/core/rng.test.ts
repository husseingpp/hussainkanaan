import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, randRange } from './rng';

describe('mulberry32', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = mulberry32(1337);
    const b = mulberry32(1337);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randRange', () => {
  it('stays within [min, max)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randRange(r, -5, 10);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('hashSeed', () => {
  it('is stable and distinguishes distinct strings', () => {
    expect(hashSeed('dotfront')).toBe(hashSeed('dotfront'));
    expect(hashSeed('dotfront')).not.toBe(hashSeed('DOTFRONT'));
  });
});
