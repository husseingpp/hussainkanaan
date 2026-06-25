import { describe, it, expect } from 'vitest';
import { addDays, classifyExpiry, daysUntil } from './expiry';

describe('addDays', () => {
  it('advances the calendar date, crossing months', () => {
    expect(addDays('2026-06-25', 90)).toBe('2026-09-23');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('daysUntil', () => {
  it('is positive in the future, negative in the past', () => {
    expect(daysUntil('2026-07-05', '2026-06-25')).toBe(10);
    expect(daysUntil('2026-06-20', '2026-06-25')).toBe(-5);
  });
});

describe('classifyExpiry', () => {
  const asOf = '2026-06-25';
  const near = 90; // -> window ends 2026-09-23

  it('flags dates before asOf as expired', () => {
    expect(classifyExpiry('2026-05-31', asOf, near)).toBe('expired');
  });

  it('flags dates within the near window as expiring', () => {
    expect(classifyExpiry('2026-07-31', asOf, near)).toBe('expiring');
    expect(classifyExpiry('2026-09-23', asOf, near)).toBe('expiring'); // boundary inclusive
  });

  it('flags dates beyond the window as ok', () => {
    expect(classifyExpiry('2026-09-30', asOf, near)).toBe('ok');
  });

  it('treats a missing expiry date as ok', () => {
    expect(classifyExpiry(null, asOf, near)).toBe('ok');
  });
});
