import { add, div, frac, mul, ZERO, type Fraction } from './fraction.ts';

export interface TaxRate {
  id: string;
  name: string;
  /** Rate in basis points: 11% = 1100. */
  rateBps: number;
  /** Price already includes this tax (common in Europe and the Middle East) vs added on top (US). */
  inclusive: boolean;
  /** Tax on tax: charged on the net amount plus every simple tax and every earlier compound tax. */
  compound: boolean;
}

export interface ExactTaxes {
  /** Amount before any tax. */
  net: Fraction;
  /** Unrounded tax per rate id, in the group's order. */
  taxes: Map<string, Fraction>;
}

const BPS = 10_000n;

/**
 * Split an amount into net and taxes for one tax group.
 *
 * A group is either all-inclusive or all-exclusive: for inclusive pricing the
 * amount is the shelf price and the taxes are extracted from it
 * (tax = price × r / (1 + r) for a single rate); for exclusive pricing the
 * amount is the net and the taxes are added on top.
 */
export function splitTaxes(amount: number, group: readonly TaxRate[]): ExactTaxes {
  assertGroup(group);
  const simple = group.filter((t) => !t.compound);
  const compound = group.filter((t) => t.compound);
  const rate = (t: TaxRate) => frac(t.rateBps, BPS);

  const simpleSum = simple.reduce((s, t) => add(s, rate(t)), ZERO);
  let net = frac(amount);
  if (group[0]?.inclusive) {
    let factor = add(frac(1), simpleSum);
    for (const t of compound) factor = mul(factor, add(frac(1), rate(t)));
    net = div(net, factor);
  }

  const taxes = new Map<string, Fraction>();
  for (const t of simple) taxes.set(t.id, mul(net, rate(t)));
  let base = mul(net, add(frac(1), simpleSum));
  for (const t of compound) {
    const amountForRate = mul(base, rate(t));
    taxes.set(t.id, amountForRate);
    base = add(base, amountForRate);
  }
  // Keep the caller's ordering for display.
  const ordered = new Map<string, Fraction>();
  for (const t of group) ordered.set(t.id, taxes.get(t.id) ?? ZERO);
  return { net, taxes: ordered };
}

/** Sum of all taxes in a split. */
export function taxTotal(split: ExactTaxes): Fraction {
  let total = ZERO;
  for (const v of split.taxes.values()) total = add(total, v);
  return total;
}

/** Gross amount of a split: net plus every tax. */
export function grossOf(split: ExactTaxes): Fraction {
  return add(split.net, taxTotal(split));
}

function assertGroup(group: readonly TaxRate[]): void {
  const ids = new Set<string>();
  for (const t of group) {
    if (!Number.isInteger(t.rateBps) || t.rateBps < 0) {
      throw new RangeError(`tax ${t.id}: rateBps must be a non-negative integer`);
    }
    if (ids.has(t.id)) throw new RangeError(`tax ${t.id} appears twice in one group`);
    ids.add(t.id);
    if (t.inclusive !== group[0]?.inclusive) {
      throw new RangeError('a tax group must be all-inclusive or all-exclusive');
    }
  }
}
