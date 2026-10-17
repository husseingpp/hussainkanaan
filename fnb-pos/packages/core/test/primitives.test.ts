import assert from 'node:assert/strict';
import { test } from 'node:test';
import { divRound, formatReceiptNo, parseRate, parseReceiptNo, roundToIncrement, uuidv7, uuidv7Time } from '../src/index.ts';

test('divRound handles every mode and sign exactly', () => {
  assert.equal(divRound(5n, 2n), 3n);
  assert.equal(divRound(-5n, 2n), -3n);
  assert.equal(divRound(4n, 3n, 'up'), 2n);
  assert.equal(divRound(-4n, 3n, 'up'), -1n);
  assert.equal(divRound(5n, 3n, 'down'), 1n);
  assert.equal(divRound(-5n, 3n, 'down'), -2n);
  assert.throws(() => divRound(1n, 0n));
});

test('roundToIncrement', () => {
  assert.equal(roundToIncrement(2_185_590, 1000), 2_186_000);
  assert.equal(roundToIncrement(2_185_499, 1000), 2_185_000);
  assert.equal(roundToIncrement(2_185_001, 1000, 'up'), 2_186_000);
  assert.equal(roundToIncrement(103, 5), 105);
  assert.throws(() => roundToIncrement(1.5, 5));
  assert.throws(() => roundToIncrement(10, 0));
});

test('parseRate', () => {
  assert.deepEqual(parseRate('89500'), { n: 89500n, d: 1n });
  assert.deepEqual(parseRate('0.92'), { n: 23n, d: 25n });
  for (const bad of ['', '-1', '1e3', '0', '1,5']) assert.throws(() => parseRate(bad), bad);
});

test('uuidv7 is versioned, time-ordered and unique', () => {
  const a = uuidv7(1_700_000_000_000);
  const b = uuidv7(1_700_000_000_001);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(uuidv7Time(a), 1_700_000_000_000);
  assert.ok(a < b);
  assert.notEqual(uuidv7(), uuidv7());
});

test('receipt numbers', () => {
  assert.equal(formatReceiptNo('B1-T2', 123), 'B1-T2-000123');
  assert.deepEqual(parseReceiptNo('B1-T2-000123'), { devicePrefix: 'B1-T2', sequence: 123 });
  assert.throws(() => formatReceiptNo('b1 t2', 1));
  assert.throws(() => formatReceiptNo('B1', 0));
});
