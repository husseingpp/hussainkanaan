import type { Currency } from "./types";

// Money is stored as INTEGER minor units of its currency:
//   USD → cents (×100), LBP → whole pounds (×1, no subunit in practice).
// These helpers convert between the stored integer and a human-entered amount.

export function minorFactor(currency: Currency): number {
  return currency === "USD" ? 100 : 1;
}

export function fractionDigits(currency: Currency): number {
  return currency === "USD" ? 2 : 0;
}

/** Human amount (e.g. 1.50) → stored minor units (e.g. 150). */
export function toMinor(amount: number, currency: Currency): number {
  return Math.round(amount * minorFactor(currency));
}

/** Stored minor units → human amount. */
export function fromMinor(minor: number, currency: Currency): number {
  return minor / minorFactor(currency);
}

/** Format stored minor units as a currency string, e.g. "$1.50" / "L£1,500,000". */
export function formatMoney(minor: number, currency: Currency): string {
  const value = fromMinor(minor, currency);
  const digits = fractionDigits(currency);
  const num = value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency === "USD" ? `$${num}` : `L£${num}`;
}

/**
 * Convert an amount in minor units from one currency to another using the
 * LBP-per-USD rate. Returns minor units of `to`, or null if a rate is needed
 * but unavailable.
 */
export function convertMinor(
  minor: number,
  from: Currency,
  to: Currency,
  fxLbpPerUsd: number | null,
): number | null {
  if (from === to) return minor;
  if (!fxLbpPerUsd || fxLbpPerUsd <= 0) return null;
  const usd = from === "USD" ? fromMinor(minor, "USD") : fromMinor(minor, "LBP") / fxLbpPerUsd;
  const target = to === "USD" ? usd : usd * fxLbpPerUsd;
  return toMinor(target, to);
}

/** Days until an ISO date ('YYYY-MM-DD'); negative if already past. null if unset. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
