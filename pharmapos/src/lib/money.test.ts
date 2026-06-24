import { describe, it, expect } from 'vitest';
import {
  CURRENCY_SYMBOL,
  MINOR_PER_MAJOR,
  computeChange,
  convert,
  extractInclusiveVat,
  formatLBP,
  formatMoney,
  formatUSD,
  lbpToUsdCents,
  parseLBP,
  parseMoney,
  parseUSD,
  paymentToUsdCents,
  roundLbp,
  settle,
  sumPaymentsUsdCents,
  usdCentsToLbp,
  type PaymentInput,
} from './money';

// A realistic-ish demo rate: 89,000 LBP per 1 USD.
const RATE = 89000;

describe('constants', () => {
  it('declares the minor-unit convention', () => {
    expect(MINOR_PER_MAJOR.USD).toBe(100);
    expect(MINOR_PER_MAJOR.LBP).toBe(1);
  });

  it('declares currency symbols', () => {
    expect(CURRENCY_SYMBOL.USD).toBe('$');
    expect(CURRENCY_SYMBOL.LBP).toBe('L.L.');
  });
});

describe('formatUSD', () => {
  it('formats whole and fractional dollars with thousands separators', () => {
    expect(formatUSD(0)).toBe('$0.00');
    expect(formatUSD(5)).toBe('$0.05');
    expect(formatUSD(1250)).toBe('$12.50');
    expect(formatUSD(1234050)).toBe('$12,340.50');
    expect(formatUSD(100000000)).toBe('$1,000,000.00');
  });

  it('formats negative amounts', () => {
    expect(formatUSD(-1250)).toBe('-$12.50');
  });

  it('rejects non-integer cents', () => {
    expect(() => formatUSD(12.5)).toThrow();
  });
});

describe('formatLBP', () => {
  it('formats whole LL with thousands separators and the L.L. suffix', () => {
    expect(formatLBP(0)).toBe('0 L.L.');
    expect(formatLBP(150000)).toBe('150,000 L.L.');
    expect(formatLBP(1112500)).toBe('1,112,500 L.L.');
  });

  it('formats negative amounts', () => {
    expect(formatLBP(-150000)).toBe('-150,000 L.L.');
  });

  it('rejects non-integer LL', () => {
    expect(() => formatLBP(1500.5)).toThrow();
  });
});

describe('formatMoney', () => {
  it('dispatches on currency', () => {
    expect(formatMoney(1250, 'USD')).toBe('$12.50');
    expect(formatMoney(150000, 'LBP')).toBe('150,000 L.L.');
  });
});

describe('parseUSD', () => {
  it('parses symbols, separators, whitespace and decimals into cents', () => {
    expect(parseUSD('$12.50')).toBe(1250);
    expect(parseUSD('12.5')).toBe(1250);
    expect(parseUSD('12')).toBe(1200);
    expect(parseUSD('1,000')).toBe(100000);
    expect(parseUSD(' $1,234.05 ')).toBe(123405);
    expect(parseUSD('0.05')).toBe(5);
    expect(parseUSD('-12.50')).toBe(-1250);
  });

  it('rejects sub-cent precision and garbage', () => {
    expect(() => parseUSD('12.555')).toThrow();
    expect(() => parseUSD('abc')).toThrow();
    expect(() => parseUSD('')).toThrow();
  });
});

describe('parseLBP', () => {
  it('parses suffixes, separators and whitespace into whole LL', () => {
    expect(parseLBP('150,000 L.L.')).toBe(150000);
    expect(parseLBP('89000')).toBe(89000);
    expect(parseLBP('89,000 LL')).toBe(89000);
    expect(parseLBP(' 1,112,500 ')).toBe(1112500);
  });

  it('rejects decimals and garbage', () => {
    expect(() => parseLBP('1.5')).toThrow();
    expect(() => parseLBP('xyz')).toThrow();
  });
});

describe('parseMoney', () => {
  it('dispatches on currency', () => {
    expect(parseMoney('$12.50', 'USD')).toBe(1250);
    expect(parseMoney('150,000 L.L.', 'LBP')).toBe(150000);
  });
});

describe('usdCentsToLbp', () => {
  it('converts exact values', () => {
    expect(usdCentsToLbp(0, RATE)).toBe(0);
    expect(usdCentsToLbp(100, RATE)).toBe(89000); // $1.00
    expect(usdCentsToLbp(1, RATE)).toBe(890); // 1 cent
    expect(usdCentsToLbp(1250, RATE)).toBe(1112500); // $12.50
  });

  it('rounds to the nearest whole LL', () => {
    expect(usdCentsToLbp(1, 90001)).toBe(900); // 900.01 -> 900
    expect(usdCentsToLbp(1, 90050)).toBe(901); // 900.50 -> 901
  });

  it('rejects bad inputs', () => {
    expect(() => usdCentsToLbp(12.5, RATE)).toThrow();
    expect(() => usdCentsToLbp(100, 0)).toThrow();
    expect(() => usdCentsToLbp(100, -1)).toThrow();
  });
});

describe('lbpToUsdCents', () => {
  it('converts exact values', () => {
    expect(lbpToUsdCents(0, RATE)).toBe(0);
    expect(lbpToUsdCents(89000, RATE)).toBe(100); // $1.00
    expect(lbpToUsdCents(890, RATE)).toBe(1); // 1 cent
    expect(lbpToUsdCents(1112500, RATE)).toBe(1250); // $12.50
  });

  it('rounds to the nearest cent', () => {
    expect(lbpToUsdCents(445, RATE)).toBe(1); // 0.50 cent -> 1
    expect(lbpToUsdCents(444, RATE)).toBe(0); // 0.498 cent -> 0
  });
});

describe('convert', () => {
  it('is the identity for same-currency conversion', () => {
    expect(convert(1250, 'USD', 'USD', RATE)).toBe(1250);
    expect(convert(150000, 'LBP', 'LBP', RATE)).toBe(150000);
  });

  it('round-trips within rounding tolerance', () => {
    const lbp = convert(1250, 'USD', 'LBP', RATE);
    expect(lbp).toBe(1112500);
    expect(convert(lbp, 'LBP', 'USD', RATE)).toBe(1250);
  });
});

describe('roundLbp', () => {
  it('rounds to the nearest step (ties up)', () => {
    expect(roundLbp(1112500, 1000)).toBe(1113000);
    expect(roundLbp(1112400, 1000)).toBe(1112000);
    expect(roundLbp(1112499, 1000)).toBe(1112000);
    expect(roundLbp(500, 1000)).toBe(1000);
    expect(roundLbp(499, 1000)).toBe(0);
  });

  it('treats a non-positive step as no rounding', () => {
    expect(roundLbp(1112500, 0)).toBe(1112500);
  });

  it('rounds negatives away from zero on a tie', () => {
    expect(roundLbp(-1500, 1000)).toBe(-2000);
  });
});

describe('extractInclusiveVat', () => {
  it('splits a VAT-inclusive amount into net + vat that sum exactly', () => {
    expect(extractInclusiveVat(1110, 0.11)).toEqual({ net: 1000, vat: 110 });
    const r = extractInclusiveVat(150, 0.11);
    expect(r.net + r.vat).toBe(150);
    expect(r.vat).toBe(15); // 150 - round(150/1.11)
  });

  it('returns zero VAT when the rate is 0', () => {
    expect(extractInclusiveVat(150000, 0)).toEqual({ net: 150000, vat: 0 });
  });

  it('rejects negative rates', () => {
    expect(() => extractInclusiveVat(100, -0.1)).toThrow();
  });
});

describe('settlement', () => {
  it('sums and converts mixed-currency payments to USD cents', () => {
    const payments: PaymentInput[] = [
      { currency: 'USD', amountMinor: 1000 },
      { currency: 'LBP', amountMinor: 250000 },
    ];
    expect(paymentToUsdCents(payments[0], RATE)).toBe(1000);
    expect(paymentToUsdCents(payments[1], RATE)).toBe(281); // 250,000 LL
    expect(sumPaymentsUsdCents(payments, RATE)).toBe(1281);
  });

  it('reports exact settlement', () => {
    const s = settle([{ currency: 'USD', amountMinor: 1250 }], 1250, RATE);
    expect(s).toEqual({ paidUsdCents: 1250, balanceUsdCents: 0, settled: true });
  });

  it('reports an outstanding balance when underpaid', () => {
    const s = settle([{ currency: 'USD', amountMinor: 1000 }], 1250, RATE);
    expect(s.settled).toBe(false);
    expect(s.balanceUsdCents).toBe(-250);
  });

  it('reports change due when overpaid', () => {
    const s = settle([{ currency: 'USD', amountMinor: 1500 }], 1000, RATE);
    expect(s.settled).toBe(true);
    expect(s.balanceUsdCents).toBe(500);
  });
});

describe('computeChange', () => {
  it('returns zero change when settled exactly or underpaid', () => {
    expect(computeChange([{ currency: 'USD', amountMinor: 1000 }], 1000, RATE, 1000)).toEqual({
      changeUsdCents: 0,
      changeLbp: 0,
      roundedChangeLbp: 0,
      roundingLbp: 0,
    });
    expect(
      computeChange([{ currency: 'USD', amountMinor: 500 }], 1000, RATE, 1000).changeUsdCents,
    ).toBe(0);
  });

  it('computes LL change with no rounding remainder', () => {
    const r = computeChange([{ currency: 'USD', amountMinor: 1500 }], 1000, RATE, 1000);
    expect(r.changeUsdCents).toBe(500);
    expect(r.changeLbp).toBe(445000);
    expect(r.roundedChangeLbp).toBe(445000);
    expect(r.roundingLbp).toBe(0);
  });

  it('applies the LL rounding step and records the rounding line', () => {
    const r = computeChange([{ currency: 'USD', amountMinor: 1501 }], 1000, RATE, 1000);
    expect(r.changeUsdCents).toBe(501);
    expect(r.changeLbp).toBe(445890);
    expect(r.roundedChangeLbp).toBe(446000);
    expect(r.roundingLbp).toBe(110);
  });
});

describe('integer invariant (never floats)', () => {
  it('every money output is an integer minor unit', () => {
    const samples: number[] = [];
    for (let cents = 0; cents <= 5000; cents += 37) {
      const lbp = usdCentsToLbp(cents, RATE);
      samples.push(lbp);
      samples.push(lbpToUsdCents(lbp, RATE));
      samples.push(roundLbp(lbp, 1000));
      const change = computeChange([{ currency: 'USD', amountMinor: cents + 250 }], cents, RATE, 1000);
      samples.push(change.changeUsdCents, change.changeLbp, change.roundedChangeLbp, change.roundingLbp);
    }
    for (const value of samples) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
