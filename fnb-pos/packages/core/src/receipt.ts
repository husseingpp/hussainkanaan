/**
 * Per-device receipt numbers such as B1-T2-000123. Each device owns its own
 * series, so two terminals selling offline never issue the same number. A
 * gapless legal invoice number, where a country needs one, is assigned by the
 * server on sync instead.
 */

const PREFIX = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function formatReceiptNo(devicePrefix: string, sequence: number, width = 6): string {
  if (!PREFIX.test(devicePrefix)) throw new RangeError(`invalid receipt prefix: ${devicePrefix}`);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError('sequence must be a positive integer');
  return `${devicePrefix}-${String(sequence).padStart(width, '0')}`;
}

export function parseReceiptNo(receiptNo: string): { devicePrefix: string; sequence: number } {
  const m = /^(.+)-(\d+)$/.exec(receiptNo);
  if (!m || !PREFIX.test(m[1] ?? '')) throw new RangeError(`invalid receipt number: ${receiptNo}`);
  return { devicePrefix: m[1] ?? '', sequence: Number(m[2]) };
}
