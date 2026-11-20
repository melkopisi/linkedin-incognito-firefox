import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus } from '../src/lib/status.js';

const base = { a: { verifiedValue: 'DISCLOSE_FULL', error: false }, b: { enabled: false, confirmed: false }, tripped: false, fallbackFailed: false };
const s = (over) => computeStatus({ ...base, ...over });

test('fallback failure is the loudest warning', () => {
  assert.deepEqual(s({ fallbackFailed: true, a: { verifiedValue: null, error: true } }),
    { level: 'warning', label: 'You are currently visible to profiles you view', badge: '!' });
});

test('verified HIDE is Private (verified)', () => {
  assert.deepEqual(s({ a: { verifiedValue: 'HIDE', error: false } }), { level: 'protected', label: 'Private (verified)', badge: '' });
});

test('verified HIDE after a trip keeps the ! badge', () => {
  assert.equal(s({ a: { verifiedValue: 'HIDE', error: false }, tripped: true }).badge, '!');
});

test('B on and confirmed is Protected (experimental)', () => {
  assert.deepEqual(s({ b: { enabled: true, confirmed: true } }), { level: 'protected', label: 'Protected (experimental)', badge: '' });
});

test('B on but unconfirmed is Experimental — not yet confirmed', () => {
  assert.deepEqual(s({ b: { enabled: true, confirmed: false } }), { level: 'experimental', label: 'Experimental — not yet confirmed', badge: '' });
});

test('A error is Error, unknown value is Unknown, never protected', () => {
  assert.deepEqual(s({ a: { verifiedValue: null, error: true } }), { level: 'unknown', label: 'Error', badge: '' });
  assert.deepEqual(s({ a: { verifiedValue: null, error: false } }), { level: 'unknown', label: 'Unknown', badge: '' });
});

test('DISCLOSE_FULL with B off is Public', () => {
  assert.deepEqual(s({}), { level: 'unprotected', label: 'Public', badge: '' });
});

test('DISCLOSE_ANONYMOUS is not treated as private mode', () => {
  assert.equal(s({ a: { verifiedValue: 'DISCLOSE_ANONYMOUS', error: false } }).label, 'Public');
});
