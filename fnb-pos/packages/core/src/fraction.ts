import { divRound, type RoundingMode } from './rounding.ts';

/** An exact rational number, used to carry tax amounts unrounded until the rounding step. */
export interface Fraction {
  readonly n: bigint;
  readonly d: bigint;
}

export const ZERO: Fraction = { n: 0n, d: 1n };

export function frac(n: bigint | number, d: bigint | number = 1n): Fraction {
  const nb = BigInt(n);
  const db = BigInt(d);
  if (db === 0n) throw new RangeError('zero denominator');
  return normalize(nb, db);
}

export function add(a: Fraction, b: Fraction): Fraction {
  return normalize(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Fraction, b: Fraction): Fraction {
  return normalize(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return normalize(a.n * b.n, a.d * b.d);
}

export function div(a: Fraction, b: Fraction): Fraction {
  if (b.n === 0n) throw new RangeError('division by zero');
  return normalize(a.n * b.d, a.d * b.n);
}

export function toMinor(f: Fraction, mode: RoundingMode = 'nearest'): number {
  return Number(divRound(f.n, f.d, mode));
}

function normalize(n: bigint, d: bigint): Fraction {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n < 0n ? -n : n, d);
  return g > 1n ? { n: n / g, d: d / g } : { n, d };
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}
