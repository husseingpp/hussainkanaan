import { parseRate, type SecondCurrency } from './currency.ts';
import { add, div, frac, mul, sub, toMinor, ZERO, type Fraction } from './fraction.ts';
import { assertMinor, roundToIncrement } from './rounding.ts';

export interface Tender {
  method: string;
  /** Which of the account's two currencies the amount is in. */
  currency: 'base' | 'second';
  /** Minor units of that currency. */
  amount: number;
}

export interface Settlement {
  /** True once nothing is left to collect in either currency. */
  settled: boolean;
  balanceBase: number;
  /** Balance in the second currency, cash-rounded, or null when the account has no second currency. */
  balanceSecond: number | null;
  /** Change owed if the customer gives it all back in base currency. */
  changeBase: number;
  /** Change owed if given in the second currency (rounded down to the cash step), or null. */
  changeSecond: number | null;
}

/**
 * Work out what is still due (or owed back) on an order paid with a mix of
 * tenders in the base and second currency. Second-currency tenders are valued
 * at the buy rate; change in the second currency uses the sell rate.
 */
export function settle(totalBase: number, tenders: readonly Tender[], fx?: SecondCurrency): Settlement {
  assertMinor(totalBase);
  let paid: Fraction = ZERO;
  for (const t of tenders) {
    assertMinor(t.amount);
    if (t.currency === 'base') {
      paid = add(paid, frac(t.amount));
    } else {
      if (!fx) throw new RangeError('second-currency tender on an account without a second currency');
      paid = add(paid, secondToBaseExact(t.amount, fx, fx.buyRate));
    }
  }

  const remaining = sub(frac(totalBase), paid);
  if (remaining.n > 0n) {
    const balanceBase = toMinor(remaining);
    const balanceSecond = fx
      ? roundToIncrement(toMinor(baseToSecondExact(remaining, fx, fx.buyRate)), fx.rounding.increment, fx.rounding.mode)
      : null;
    return {
      // A sliver under half a cent (or half a cash step) left by a rate conversion counts as paid.
      settled: balanceBase === 0 && (balanceSecond ?? 0) === 0,
      balanceBase,
      balanceSecond,
      changeBase: 0,
      changeSecond: fx ? 0 : null,
    };
  }

  const over = sub(ZERO, remaining);
  return {
    settled: true,
    balanceBase: 0,
    balanceSecond: fx ? 0 : null,
    changeBase: toMinor(over, 'down'),
    changeSecond: fx
      ? roundToIncrement(toMinor(baseToSecondExact(over, fx, fx.sellRate ?? fx.buyRate), 'down'), fx.rounding.increment, 'down')
      : null,
  };
}

function baseToSecondExact(amountBase: Fraction, fx: SecondCurrency, rate: string): Fraction {
  const scale = frac(10n ** BigInt(fx.second.decimals), 10n ** BigInt(fx.base.decimals));
  return mul(mul(amountBase, parseRate(rate)), scale);
}

function secondToBaseExact(amountSecond: number, fx: SecondCurrency, rate: string): Fraction {
  const scale = frac(10n ** BigInt(fx.base.decimals), 10n ** BigInt(fx.second.decimals));
  return mul(div(frac(amountSecond), parseRate(rate)), scale);
}
