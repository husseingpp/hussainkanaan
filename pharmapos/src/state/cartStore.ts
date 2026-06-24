/**
 * Checkout cart state (Zustand). Holds the lines being rung up, an optional
 * whole-sale discount, and the tendered payments. No money math lives here — that
 * is computed from this state via money.ts / saleAssembly's computeTotals.
 */

import { create } from 'zustand';
import type { NewPaymentInput } from '../data/repository';
import type { Product } from '../data/types';

export interface CartLine {
  product: Product;
  batchId: string;
  qty: number;
  lineDiscountUsdCents: number;
}

interface CartState {
  lines: CartLine[];
  wholeDiscountUsdCents: number;
  payments: NewPaymentInput[];
  addProduct: (product: Product, batchId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setLineDiscount: (productId: string, cents: number) => void;
  removeLine: (productId: string) => void;
  setWholeDiscount: (cents: number) => void;
  addPayment: (payment: NewPaymentInput) => void;
  removePayment: (index: number) => void;
  clearPayments: () => void;
  reset: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  wholeDiscountUsdCents: 0,
  payments: [],

  addProduct: (product, batchId) =>
    set((s) => {
      const existing = s.lines.find((l) => l.product.id === product.id);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      return { lines: [...s.lines, { product, batchId, qty: 1, lineDiscountUsdCents: 0 }] };
    }),

  setQty: (productId, qty) =>
    set((s) => ({
      lines: s.lines.flatMap((l) => {
        if (l.product.id !== productId) return [l];
        return qty <= 0 ? [] : [{ ...l, qty }];
      }),
    })),

  setLineDiscount: (productId, cents) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === productId ? { ...l, lineDiscountUsdCents: Math.max(0, cents) } : l,
      ),
    })),

  removeLine: (productId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.product.id !== productId) })),

  setWholeDiscount: (cents) => set({ wholeDiscountUsdCents: Math.max(0, cents) }),

  addPayment: (payment) => set((s) => ({ payments: [...s.payments, payment] })),

  removePayment: (index) =>
    set((s) => ({ payments: s.payments.filter((_, i) => i !== index) })),

  clearPayments: () => set({ payments: [] }),

  reset: () => set({ lines: [], wholeDiscountUsdCents: 0, payments: [] }),
}));
