/**
 * Exact integer rounding. All money math in core is done on integers (minor
 * units) or bigint fractions and rounded only here, so results never depend
 * on floating-point error.
 */

export type RoundingMode = 'nearest' | 'up' | 'down';

/** Divide two bigints and round the quotient. `nearest` rounds half away from zero. */
export function divRound(num: bigint, den: bigint, mode: RoundingMode = 'nearest'): bigint {
  if (den === 0n) throw new RangeError('division by zero');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const q = num / den; // truncates toward zero
  const r = num % den;
  if (r === 0n) return q;
  const sign = num < 0n ? -1n : 1n;
  switch (mode) {
    case 'down':
      return sign < 0n ? q - 1n : q;
    case 'up':
      return sign < 0n ? q : q + 1n;
    case 'nearest': {
      const twice = (r < 0n ? -r : r) * 2n;
      return twice >= den ? q + sign : q;
    }
  }
}

/** Round an integer amount to a multiple of `increment` (e.g. LBP to the nearest 1,000). */
export function roundToIncrement(amount: number, increment: number, mode: RoundingMode = 'nearest'): number {
  assertMinor(amount);
  if (!Number.isSafeInteger(increment) || increment <= 0) {
    throw new RangeError(`rounding increment must be a positive integer, got ${increment}`);
  }
  const steps = divRound(BigInt(amount), BigInt(increment), mode);
  return Number(steps * BigInt(increment));
}

export function assertMinor(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`money must be an integer number of minor units, got ${amount}`);
  }
}
