import { div, frac, mul, toMinor, type Fraction } from './fraction.ts';
import { assertMinor, roundToIncrement, type RoundingMode } from './rounding.ts';

export interface Currency {
  /** ISO 4217 code, e.g. USD. */
  code: string;
  /** Digits in the minor unit the account uses (USD 2, LBP 0). Money is stored as integers of this unit. */
  decimals: number;
}

/** How cash in the second currency is rounded, e.g. LBP to the nearest 1,000. */
export interface CashRounding {
  /** Step in minor units of the second currency (1000 for LBP thousands, 5 for 0.05 in a 2-decimal currency). */
  increment: number;
  mode: RoundingMode;
}

/**
 * The account's second-currency setup, snapshotted onto every order.
 * Rates are "second-currency units per 1 base unit", kept as decimal strings
 * so they round-trip exactly through the database and sync.
 */
export interface SecondCurrency {
  base: Currency;
  second: Currency;
  /** Rate used when the customer pays in the second currency. */
  buyRate: string;
  /** Rate used when change is given in the second currency. Defaults to buyRate. */
  sellRate?: string;
  rounding: CashRounding;
}

/** Parse a positive decimal rate string ("89500", "0.92") into an exact fraction. */
export function parseRate(rate: string): Fraction {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!m) throw new RangeError(`invalid exchange rate: ${rate}`);
  const digits = m[2] ?? '';
  const f = frac(BigInt((m[1] ?? '') + digits), 10n ** BigInt(digits.length));
  if (f.n === 0n) throw new RangeError('exchange rate must be greater than zero');
  return f;
}

/** Convert base minor units to second-currency minor units at `rate`, rounded to the second currency's minor unit only. */
export function toSecondExact(amountBase: number, fx: SecondCurrency, rate: string = fx.buyRate): number {
  assertMinor(amountBase);
  const scale = frac(10n ** BigInt(fx.second.decimals), 10n ** BigInt(fx.base.decimals));
  return toMinor(mul(mul(frac(amountBase), parseRate(rate)), scale));
}

/** Convert base minor units to the second currency and apply the account's cash rounding. */
export function toSecond(amountBase: number, fx: SecondCurrency, rate: string = fx.buyRate): number {
  return roundToIncrement(toSecondExact(amountBase, fx, rate), fx.rounding.increment, fx.rounding.mode);
}

/** Convert second-currency minor units back to base minor units at `rate`. */
export function toBase(amountSecond: number, fx: SecondCurrency, rate: string = fx.buyRate, mode: RoundingMode = 'nearest'): number {
  assertMinor(amountSecond);
  const scale = frac(10n ** BigInt(fx.base.decimals), 10n ** BigInt(fx.second.decimals));
  return toMinor(mul(div(frac(amountSecond), parseRate(rate)), scale), mode);
}
