/**
 * money.ts — the single source of truth for all money math in PharmaPOS.
 *
 * Non-negotiable rules (see CLAUDE.md / BLUEPRINT.md §5):
 *  - Money is ALWAYS stored as integer minor units. NEVER floats.
 *      USD  -> cents      ($12.50 -> 1250)
 *      LBP  -> whole LL   (150,000 LL -> 150000, no subunits)
 *  - Canonical pricing currency is USD cents. Convert to LL at display/checkout only.
 *  - The exchange rate is `usd_to_lbp` = whole LBP per 1 USD (an integer).
 *  - Every conversion / rounding here is done with BigInt internally so we never
 *    touch a float. Inputs and outputs are plain integer `number`s.
 *
 * ALL money operations in the app must flow through this module. No ad-hoc math.
 */

export type Currency = 'USD' | 'LBP';

/** Number of minor units per 1 major unit of each currency. */
export const MINOR_PER_MAJOR: Record<Currency, number> = {
  USD: 100, // cents
  LBP: 1, // whole LL — no subunits in practice
};

/** Human label used when formatting each currency. */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  LBP: 'L.L.',
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function assertInt(value: number, name = 'amount'): void {
  if (!Number.isInteger(value)) {
    throw new Error(`money: ${name} must be an integer minor unit, got ${value}`);
  }
}

function assertRate(rate: number): void {
  if (!Number.isInteger(rate) || rate <= 0) {
    throw new Error(`money: exchange rate must be a positive integer (LBP per USD), got ${rate}`);
  }
}

// ---------------------------------------------------------------------------
// Integer arithmetic helpers (BigInt — never floats)
// ---------------------------------------------------------------------------

/**
 * Divide two BigInts, rounding the result to the nearest integer
 * (ties rounded away from zero). Used for currency conversion and LL rounding.
 */
function roundDivBig(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('money: division by zero');
  }
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const half = d / 2n;
  return n >= 0n ? (n + half) / d : -((-n + half) / d);
}

/** Insert thousands separators into a string of digits (no sign, no decimals). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Divide two integers, rounding the quotient to the nearest integer (ties away
 * from zero). Integer-exact (BigInt) — use this for any money apportioning, e.g.
 * allocating a whole-sale discount across lines.
 */
export function roundDiv(numerator: number, denominator: number): number {
  assertInt(numerator, 'numerator');
  assertInt(denominator, 'denominator');
  return Number(roundDivBig(BigInt(numerator), BigInt(denominator)));
}

// ---------------------------------------------------------------------------
// Formatting (minor units -> display string)
// ---------------------------------------------------------------------------

/** Format USD cents, e.g. 1234050 -> "$12,340.50". */
export function formatUSD(cents: number): string {
  assertInt(cents, 'USD cents');
  const neg = cents < 0;
  const abs = BigInt(Math.abs(cents));
  const dollars = abs / 100n;
  const rem = abs % 100n;
  const body = `$${groupThousands(dollars.toString())}.${rem.toString().padStart(2, '0')}`;
  return neg ? `-${body}` : body;
}

/** Format whole LBP, e.g. 1112500 -> "1,112,500 L.L.". */
export function formatLBP(whole: number): string {
  assertInt(whole, 'LBP amount');
  const neg = whole < 0;
  const abs = BigInt(Math.abs(whole)).toString();
  const body = `${groupThousands(abs)} L.L.`;
  return neg ? `-${body}` : body;
}

/** Format any supported currency's minor units. */
export function formatMoney(minor: number, currency: Currency): string {
  return currency === 'USD' ? formatUSD(minor) : formatLBP(minor);
}

// ---------------------------------------------------------------------------
// Parsing (display string -> minor units)
// ---------------------------------------------------------------------------

/**
 * Parse a USD string into cents. Accepts an optional `$`, thousands separators,
 * surrounding whitespace, and up to 2 decimal places. Rejects sub-cent values.
 *   "$12.50" -> 1250   "1,000" -> 100000   "12.5" -> 1250
 */
export function parseUSD(input: string): number {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) {
    throw new Error(`money: cannot parse USD value "${input}"`);
  }
  const sign = m[1] === '-' ? -1 : 1;
  const dollars = Number(m[2]);
  const frac = Number((m[3] ?? '').padEnd(2, '0'));
  return sign * (dollars * 100 + frac);
}

/**
 * Parse an LBP string into whole LL. Accepts an optional "L.L."/"LL" suffix,
 * thousands separators, and surrounding whitespace. Rejects any decimals.
 *   "150,000 L.L." -> 150000   "89000" -> 89000
 */
export function parseLBP(input: string): number {
  const cleaned = input
    .trim()
    .replace(/L\.?L\.?/gi, '')
    .replace(/[,\s]/g, '');
  const m = /^(-?)(\d+)$/.exec(cleaned);
  if (!m) {
    throw new Error(`money: cannot parse LBP value "${input}"`);
  }
  return (m[1] === '-' ? -1 : 1) * Number(m[2]);
}

/** Parse a string into minor units for the given currency. */
export function parseMoney(input: string, currency: Currency): number {
  return currency === 'USD' ? parseUSD(input) : parseLBP(input);
}

// ---------------------------------------------------------------------------
// Conversion (rate = whole LBP per 1 USD)
// ---------------------------------------------------------------------------

/** Convert USD cents -> whole LBP at the given rate (nearest LL). */
export function usdCentsToLbp(cents: number, rate: number): number {
  assertInt(cents, 'USD cents');
  assertRate(rate);
  // lbp = cents / 100 * rate
  return Number(roundDivBig(BigInt(cents) * BigInt(rate), 100n));
}

/** Convert whole LBP -> USD cents at the given rate (nearest cent). */
export function lbpToUsdCents(lbp: number, rate: number): number {
  assertInt(lbp, 'LBP amount');
  assertRate(rate);
  // cents = lbp / rate * 100
  return Number(roundDivBig(BigInt(lbp) * 100n, BigInt(rate)));
}

/** Convert a minor-unit amount from one currency to another at the given rate. */
export function convert(minor: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) {
    assertInt(minor, `${from} amount`);
    return minor;
  }
  return from === 'USD' ? usdCentsToLbp(minor, rate) : lbpToUsdCents(minor, rate);
}

// ---------------------------------------------------------------------------
// LL rounding (tiny denominations don't circulate)
// ---------------------------------------------------------------------------

/**
 * Round a whole-LBP amount to the nearest multiple of `step`
 * (e.g. step = 1000 rounds to the nearest 1,000 LL).
 * A non-positive step means "no rounding".
 */
export function roundLbp(amount: number, step: number): number {
  assertInt(amount, 'LBP amount');
  if (!Number.isInteger(step)) {
    throw new Error(`money: rounding step must be an integer, got ${step}`);
  }
  if (step <= 0) {
    return amount;
  }
  const steps = roundDivBig(BigInt(amount), BigInt(step));
  return Number(steps * BigInt(step));
}

// ---------------------------------------------------------------------------
// VAT (prices are VAT-inclusive — Lebanon 11%)
// ---------------------------------------------------------------------------

export interface VatBreakdown {
  /** Amount excluding VAT. */
  net: number;
  /** The VAT component. `net + vat === inclusiveMinor` exactly. */
  vat: number;
}

/**
 * Extract the VAT component from a VAT-INCLUSIVE amount in minor units.
 * `vatRate` is a decimal (e.g. 0.11 for 11%). Computed in basis points with BigInt
 * so the result stays an exact integer split: `net + vat === inclusiveMinor`.
 */
export function extractInclusiveVat(inclusiveMinor: number, vatRate: number): VatBreakdown {
  assertInt(inclusiveMinor, 'inclusive amount');
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new Error(`money: vatRate must be a finite number >= 0, got ${vatRate}`);
  }
  const basisPoints = BigInt(Math.round(vatRate * 10000));
  const denominator = 10000n + basisPoints;
  const net = Number(roundDivBig(BigInt(inclusiveMinor) * 10000n, denominator));
  return { net, vat: inclusiveMinor - net };
}

// ---------------------------------------------------------------------------
// Settlement & change (multi-line, multi-currency payments)
// ---------------------------------------------------------------------------

export interface PaymentInput {
  currency: Currency;
  /** Amount in the payment currency's minor units. */
  amountMinor: number;
}

/** Convert a single payment to canonical USD cents at the sale's rate. */
export function paymentToUsdCents(payment: PaymentInput, rate: number): number {
  return payment.currency === 'USD'
    ? (assertInt(payment.amountMinor, 'USD cents'), payment.amountMinor)
    : lbpToUsdCents(payment.amountMinor, rate);
}

/** Sum a list of payments into canonical USD cents. */
export function sumPaymentsUsdCents(payments: PaymentInput[], rate: number): number {
  return payments.reduce((acc, p) => acc + paymentToUsdCents(p, rate), 0);
}

export interface Settlement {
  /** Total tendered, in canonical USD cents. */
  paidUsdCents: number;
  /** paid - total. Positive = change due to customer; negative = still owed. */
  balanceUsdCents: number;
  /** True once the customer has tendered at least the total. */
  settled: boolean;
}

/** Compare payments against a USD-cents total at the sale's rate. */
export function settle(payments: PaymentInput[], totalUsdCents: number, rate: number): Settlement {
  assertInt(totalUsdCents, 'total USD cents');
  const paidUsdCents = sumPaymentsUsdCents(payments, rate);
  const balanceUsdCents = paidUsdCents - totalUsdCents;
  return { paidUsdCents, balanceUsdCents, settled: balanceUsdCents >= 0 };
}

export interface ChangeResult {
  /** Overpayment in canonical USD cents (0 if nothing is owed back). */
  changeUsdCents: number;
  /** That change expressed in LBP, before rounding. */
  changeLbp: number;
  /** Change in LBP after rounding to the configured step. */
  roundedChangeLbp: number;
  /** roundedChangeLbp - changeLbp — store as an explicit line so totals reconcile. */
  roundingLbp: number;
}

/**
 * Compute change owed back to the customer in LBP, applying the configured LL
 * rounding step. Change currency is LBP (the usual choice in Lebanon).
 */
export function computeChange(
  payments: PaymentInput[],
  totalUsdCents: number,
  rate: number,
  roundingStep: number,
): ChangeResult {
  const { balanceUsdCents } = settle(payments, totalUsdCents, rate);
  const changeUsdCents = Math.max(0, balanceUsdCents);
  const changeLbp = usdCentsToLbp(changeUsdCents, rate);
  const roundedChangeLbp = roundLbp(changeLbp, roundingStep);
  return {
    changeUsdCents,
    changeLbp,
    roundedChangeLbp,
    roundingLbp: roundedChangeLbp - changeLbp,
  };
}
