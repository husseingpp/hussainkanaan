import { describe, expect, it } from "vitest";

import { cartTotals, lineUnitPrice, type CartLine } from "./cart";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  product_id: "p1",
  name: "X",
  vat_rate: 0,
  batch_currency: "USD",
  batch_unit_price: 100, // $1.00
  available: 10,
  qty: 1,
  ...over,
});

describe("cart math", () => {
  it("sums same-currency lines with no VAT", () => {
    const t = cartTotals([line({ qty: 3 }), line({ batch_unit_price: 250, qty: 2 })], "USD", null);
    expect(t.subtotal).toBe(300 + 500);
    expect(t.vat).toBe(0);
    expect(t.grand).toBe(800);
    expect(t.convertible).toBe(true);
  });

  it("applies per-line VAT", () => {
    const t = cartTotals([line({ batch_unit_price: 1000, vat_rate: 0.11, qty: 1 })], "USD", null);
    expect(t.subtotal).toBe(1000);
    expect(t.vat).toBe(110);
    expect(t.grand).toBe(1110);
  });

  it("converts a USD line into an LBP settlement total", () => {
    const unit = lineUnitPrice(line(), "LBP", 90000);
    expect(unit).toBe(90000); // $1.00 → 90,000 LBP
    const t = cartTotals([line({ qty: 2 })], "LBP", 90000);
    expect(t.grand).toBe(180000);
    expect(t.convertible).toBe(true);
  });

  it("flags the cart as not convertible when an FX rate is missing", () => {
    const t = cartTotals([line({ batch_currency: "USD", qty: 1 })], "LBP", null);
    expect(t.convertible).toBe(false);
  });
});
