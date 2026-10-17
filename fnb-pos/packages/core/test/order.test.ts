import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeOrderTotals, settle, toSecond, toSecondExact, type SecondCurrency, type TaxRate } from '../src/index.ts';

const vat11: TaxRate = { id: 'vat', name: 'VAT 11%', rateBps: 1100, inclusive: false, compound: false };
const usdLbp: SecondCurrency = {
  base: { code: 'USD', decimals: 2 },
  second: { code: 'LBP', decimals: 0 },
  buyRate: '89500',
  rounding: { increment: 1000, mode: 'nearest' },
};

// The worked example in BLUEPRINT.md ("Tax and second-currency rules").
test('blueprint worked example: USD base, LBP second, VAT 11% exclusive, taxable 10% service', () => {
  const totals = computeOrderTotals({
    lines: [{ id: 'l1', unitPrice: 2000, quantity: 1, taxRates: [vat11] }],
    serviceCharge: { rateBps: 1000, taxRates: [vat11] },
    taxRounding: 'invoice',
  });
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.serviceCharge, 200);
  assert.deepEqual(totals.taxes, [{ taxId: 'vat', name: 'VAT 11%', amount: 242 }]);
  assert.equal(totals.total, 2442);

  assert.equal(toSecondExact(totals.total, usdLbp), 2_185_590);
  assert.equal(toSecond(totals.total, usdLbp), 2_186_000);

  const afterUsd = settle(totals.total, [{ method: 'cash', currency: 'base', amount: 2000 }], usdLbp);
  assert.equal(afterUsd.settled, false);
  assert.equal(afterUsd.balanceBase, 442);
  assert.equal(afterUsd.balanceSecond, 396_000);

  // Paying the shown LBP balance settles the order without asking for change.
  const paid = settle(
    totals.total,
    [
      { method: 'cash', currency: 'base', amount: 2000 },
      { method: 'cash', currency: 'second', amount: 396_000 },
    ],
    usdLbp,
  );
  assert.equal(paid.settled, true);
  assert.equal(paid.changeBase, 0);
  assert.equal(paid.changeSecond, 0);
});

test('inclusive pricing extracts tax = price × r / (1 + r) and totals the menu price', () => {
  const vatIncl: TaxRate = { ...vat11, inclusive: true };
  const totals = computeOrderTotals({
    lines: [{ id: 'l1', unitPrice: 1110, quantity: 1, taxRates: [vatIncl] }],
    taxRounding: 'line',
  });
  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.taxes[0]?.amount, 110);
  assert.equal(totals.total, 1110);
});

test('line vs invoice rounding can differ by a cent', () => {
  const vat5: TaxRate = { id: 'vat5', name: 'VAT 5%', rateBps: 500, inclusive: false, compound: false };
  // 0.05 × 0.10 = 0.005 per line: rounds up per line, but sums to 0.015 → 0.02 per invoice.
  const lines = [1, 2, 3].map((n) => ({ id: `l${n}`, unitPrice: 10, quantity: 1, taxRates: [vat5] }));
  assert.equal(computeOrderTotals({ lines, taxRounding: 'line' }).taxes[0]?.amount, 3);
  assert.equal(computeOrderTotals({ lines, taxRounding: 'invoice' }).taxes[0]?.amount, 2);
});

test('compound tax is charged on net plus earlier taxes', () => {
  const muni: TaxRate = { id: 'muni', name: 'Municipality 5%', rateBps: 500, inclusive: false, compound: false };
  const levy: TaxRate = { id: 'levy', name: 'Levy 10% (compound)', rateBps: 1000, inclusive: false, compound: true };
  const totals = computeOrderTotals({
    lines: [{ id: 'l1', unitPrice: 10_000, quantity: 1, taxRates: [vat11, muni, levy] }],
    taxRounding: 'invoice',
  });
  assert.deepEqual(
    totals.taxes.map((t) => t.amount),
    [1100, 500, 1160], // levy on 100 + 11 + 5
  );
  assert.equal(totals.total, 12_760);
});

test('inclusive compound group still totals the menu price', () => {
  const a: TaxRate = { id: 'a', name: 'A', rateBps: 1100, inclusive: true, compound: false };
  const b: TaxRate = { id: 'b', name: 'B', rateBps: 1000, inclusive: true, compound: true };
  const totals = computeOrderTotals({
    lines: [{ id: 'l1', unitPrice: 12_210, quantity: 1, taxRates: [a, b] }],
    taxRounding: 'invoice',
  });
  assert.equal(totals.subtotal, 10_000);
  assert.deepEqual(totals.taxes.map((t) => t.amount), [1100, 1110]);
  assert.equal(totals.total, 12_210);
});

test('rejects mixed inclusive/exclusive groups and inclusive service-charge tax', () => {
  assert.throws(() =>
    computeOrderTotals({
      lines: [{ id: 'l1', unitPrice: 100, quantity: 1, taxRates: [vat11, { ...vat11, id: 'x', inclusive: true }] }],
      taxRounding: 'line',
    }),
  );
  assert.throws(() =>
    computeOrderTotals({
      lines: [{ id: 'l1', unitPrice: 100, quantity: 1, taxRates: [] }],
      serviceCharge: { rateBps: 1000, taxRates: [{ ...vat11, inclusive: true }] },
      taxRounding: 'line',
    }),
  );
});

test('change is given with the sell rate and rounded down to the cash step', () => {
  const fx: SecondCurrency = { ...usdLbp, sellRate: '89000' };
  const s = settle(1000, [{ method: 'cash', currency: 'base', amount: 2000 }], fx);
  assert.equal(s.changeBase, 1000);
  assert.equal(s.changeSecond, 890_000);
  const odd = settle(1001, [{ method: 'cash', currency: 'base', amount: 2000 }], fx);
  assert.equal(odd.changeSecond, 889_000); // 889,110 → down to 889,000
});

test('accounts without a second currency', () => {
  const s = settle(500, [{ method: 'card', currency: 'base', amount: 200 }]);
  assert.deepEqual(s, { settled: false, balanceBase: 300, balanceSecond: null, changeBase: 0, changeSecond: null });
  assert.throws(() => settle(500, [{ method: 'cash', currency: 'second', amount: 1 }]));
});
