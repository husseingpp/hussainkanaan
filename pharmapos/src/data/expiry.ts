/**
 * Expiry classification — pure date logic for near-expiry alerts and the expiry report.
 * Dates are ISO calendar dates ('YYYY-MM-DD'), which compare correctly as strings.
 */

export type ExpiryBucket = 'expired' | 'expiring' | 'ok';

/** Add `days` to an ISO calendar date and return an ISO calendar date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `asOf` until `expiryDate` (negative if already expired). */
export function daysUntil(expiryDate: string, asOf: string): number {
  const ms = new Date(`${expiryDate}T00:00:00Z`).getTime() - new Date(`${asOf}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Bucket an expiry date relative to `asOf`:
 *   - no expiry      → 'ok'
 *   - before asOf    → 'expired'
 *   - within nearDays → 'expiring'
 *   - otherwise      → 'ok'
 */
export function classifyExpiry(
  expiryDate: string | null,
  asOf: string,
  nearDays: number,
): ExpiryBucket {
  if (!expiryDate) return 'ok';
  if (expiryDate < asOf) return 'expired';
  if (expiryDate <= addDays(asOf, nearDays)) return 'expiring';
  return 'ok';
}
