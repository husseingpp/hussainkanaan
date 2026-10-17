import { add, frac, toMinor, ZERO, type Fraction } from './fraction.ts';
import { assertMinor } from './rounding.ts';
import { splitTaxes, type ExactTaxes, type TaxRate } from './tax.ts';

export interface OrderLineInput {
  id: string;
  /** Price per unit in base minor units, as printed on the menu (tax-inclusive if its tax group is). */
  unitPrice: number;
  quantity: number;
  /** The tax group that applies to this line for the order's type (dine-in, takeaway, delivery). */
  taxRates: readonly TaxRate[];
}

export interface ServiceChargeInput {
  /** Rate in basis points on the net subtotal: 10% = 1000. */
  rateBps: number;
  /** Exclusive taxes charged on the service charge; empty when it is not taxable. */
  taxRates: readonly TaxRate[];
}

/** Round each line's taxes, or sum exact taxes and round once per invoice. Countries differ. */
export type TaxRounding = 'line' | 'invoice';

export interface OrderInput {
  lines: readonly OrderLineInput[];
  serviceCharge?: ServiceChargeInput;
  taxRounding: TaxRounding;
}

export interface TaxAmount {
  taxId: string;
  name: string;
  amount: number;
}

export interface OrderTotals {
  /** Sum of line prices as shown on the menu. */
  itemsTotal: number;
  /** Sum of line amounts before tax. */
  subtotal: number;
  serviceCharge: number;
  taxes: TaxAmount[];
  total: number;
}

/** Compute an order's totals in base minor units. All amounts are integers. */
export function computeOrderTotals(order: OrderInput): OrderTotals {
  const names = new Map<string, string>();
  const inclusive = new Set<string>();
  const exact = new Map<string, Fraction>();
  const rounded = new Map<string, number>();

  const record = (split: ExactTaxes, rates: readonly TaxRate[]) => {
    for (const t of rates) {
      names.set(t.id, t.name);
      if (t.inclusive) inclusive.add(t.id);
      const v = split.taxes.get(t.id) ?? ZERO;
      exact.set(t.id, add(exact.get(t.id) ?? ZERO, v));
      rounded.set(t.id, (rounded.get(t.id) ?? 0) + toMinor(v));
    }
  };

  let itemsTotal = 0;
  for (const line of order.lines) {
    assertMinor(line.unitPrice);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`line ${line.id}: quantity must be a positive integer`);
    }
    const amount = line.unitPrice * line.quantity;
    itemsTotal += amount;
    record(splitTaxes(amount, line.taxRates), line.taxRates);
  }

  const taxAmount = (id: string) =>
    order.taxRounding === 'line' ? (rounded.get(id) ?? 0) : toMinor(exact.get(id) ?? ZERO);
  const inclusiveTax = [...inclusive].reduce((s, id) => s + taxAmount(id), 0);
  // Net is what is left of the menu prices once inclusive tax is taken out, so
  // an inclusive-priced order with no service charge totals exactly its menu prices.
  const subtotal = itemsTotal - inclusiveTax;

  let serviceCharge = 0;
  if (order.serviceCharge) {
    const sc = order.serviceCharge;
    if (sc.taxRates.some((t) => t.inclusive)) {
      throw new RangeError('service charge taxes must be exclusive');
    }
    serviceCharge = toMinor(frac(BigInt(subtotal) * BigInt(sc.rateBps), 10_000n));
    record(splitTaxes(serviceCharge, sc.taxRates), sc.taxRates);
  }

  const taxes: TaxAmount[] = [...names].map(([taxId, name]) => ({ taxId, name, amount: taxAmount(taxId) }));
  const total = subtotal + serviceCharge + taxes.reduce((s, t) => s + t.amount, 0);
  return { itemsTotal, subtotal, serviceCharge, taxes, total };
}
