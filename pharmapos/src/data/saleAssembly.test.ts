import { describe, it, expect } from 'vitest';
import { assembleSale } from './saleAssembly';
import type { NewSaleInput, NewSaleLineInput } from './repository';

const RATE = 89000;

function line(partial: Partial<NewSaleLineInput> = {}): NewSaleLineInput {
  return {
    product_id: 'p1',
    batch_id: 'b1',
    qty: 1,
    unit_price_usd_cents: 1250,
    line_discount_usd_cents: 0,
    vat_rate: 0.11,
    ...partial,
  };
}

function input(partial: Partial<NewSaleInput> = {}): NewSaleInput {
  return {
    branch_id: 'br1',
    user_id: 'u1',
    customer_id: null,
    lines: [line()],
    payments: [{ currency: 'USD', amount_minor: 1250, method: 'cash' }],
    discount_usd_cents: 0,
    exchange_rate: RATE,
    ll_rounding_cents: 0,
    prescription_ref: null,
    ...partial,
  };
}

describe('assembleSale — totals & rows', () => {
  it('computes subtotal, VAT component and total for VAT-inclusive lines', () => {
    const r = assembleSale(
      input({
        lines: [
          line({ product_id: 'pa', batch_id: 'ba', qty: 2, unit_price_usd_cents: 150 }), // 300
          line({ product_id: 'pb', batch_id: 'bb', qty: 1, unit_price_usd_cents: 1250 }), // 1250
        ],
        payments: [{ currency: 'USD', amount_minor: 1550, method: 'cash' }],
      }),
    );

    expect(r.sale.subtotal_usd_cents).toBe(1550);
    expect(r.sale.discount_usd_cents).toBe(0);
    expect(r.sale.total_usd_cents).toBe(1550);
    expect(r.sale.vat_usd_cents).toBe(154); // 30 (on 300) + 124 (on 1250)
    expect(r.sale.status).toBe('completed');
    expect(r.sale.exchange_rate).toBe(RATE);
  });

  it('emits one line, payment row and stock movement per input', () => {
    const r = assembleSale(
      input({
        lines: [
          line({ product_id: 'pa', batch_id: 'ba', qty: 2, unit_price_usd_cents: 150 }),
          line({ product_id: 'pb', batch_id: 'bb', qty: 3, unit_price_usd_cents: 480 }),
        ],
        payments: [{ currency: 'USD', amount_minor: 5000, method: 'cash' }],
      }),
    );

    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].line_total_usd_cents).toBe(300);
    expect(r.lines[1].line_total_usd_cents).toBe(1440);
    expect(r.payments).toHaveLength(1);

    // Stock movements: one negative delta per line, referencing the sale.
    expect(r.movements.map((m) => m.qty_delta)).toEqual([-2, -3]);
    expect(r.movements.every((m) => m.type === 'sale' && m.ref_id === r.sale.id)).toBe(true);
    // Lines, payments and movements all hang off the same sale id.
    expect(r.lines.every((l) => l.sale_id === r.sale.id)).toBe(true);
    expect(r.payments.every((p) => p.sale_id === r.sale.id)).toBe(true);
  });

  it('applies a whole-sale discount and re-extracts VAT from the discounted total', () => {
    const r = assembleSale(
      input({
        lines: [
          line({ product_id: 'pa', batch_id: 'ba', qty: 2, unit_price_usd_cents: 150 }), // 300
          line({ product_id: 'pb', batch_id: 'bb', qty: 1, unit_price_usd_cents: 1250 }), // 1250
        ],
        discount_usd_cents: 155,
        payments: [{ currency: 'USD', amount_minor: 1395, method: 'cash' }],
      }),
    );

    expect(r.sale.subtotal_usd_cents).toBe(1550);
    expect(r.sale.discount_usd_cents).toBe(155);
    expect(r.sale.total_usd_cents).toBe(1395);
    expect(r.sale.vat_usd_cents).toBe(138); // 27 (on 270) + 111 (on 1125)
  });
});

describe('assembleSale — settlement guard', () => {
  it('accepts a mixed LL + $ payment that covers the total', () => {
    const r = assembleSale(
      input({
        lines: [line({ qty: 1, unit_price_usd_cents: 1550 })],
        payments: [
          { currency: 'USD', amount_minor: 1000, method: 'cash' },
          { currency: 'LBP', amount_minor: 500000, method: 'cash' }, // ≈ $5.62
        ],
      }),
    );
    expect(r.sale.total_usd_cents).toBe(1550);
  });

  it('throws when payments do not cover the total', () => {
    expect(() =>
      assembleSale(
        input({
          lines: [line({ qty: 1, unit_price_usd_cents: 1550 })],
          payments: [{ currency: 'USD', amount_minor: 1000, method: 'cash' }],
        }),
      ),
    ).toThrow(/do not cover/);
  });

  it('rejects empty sales and over-large discounts', () => {
    expect(() => assembleSale(input({ lines: [] }))).toThrow();
    expect(() =>
      assembleSale(input({ discount_usd_cents: 999999, payments: [] })),
    ).toThrow();
  });
});
