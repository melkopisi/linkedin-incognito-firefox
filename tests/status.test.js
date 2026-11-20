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

import { navLabel } from '../src/lib/status.js';
const nl = (over) => {
  const input = { ...base, ...over };
  return navLabel(computeStatus(input), input.a, input.b);
};

test('nav label: Private mode on', () => {
  assert.deepEqual(nl({ a: { verifiedValue: 'HIDE', error: false } }),
    { text: 'Private', tone: 'good', hint: 'Private mode is on (LinkedIn setting). Click to turn it off.' });
});

test('nav label: B confirmed with Private mode off is Blocking views, not Private', () => {
  assert.deepEqual(nl({ b: { enabled: true, confirmed: true } }),
    { text: 'Blocking views', tone: 'good', hint: 'View signals are being blocked. Private mode is off. Click to turn Private mode on.' });
});

test('nav label: B unconfirmed is Checking…', () => {
  assert.deepEqual(nl({ b: { enabled: true, confirmed: false } }),
    { text: 'Checking…', tone: 'pending', hint: 'Blocking is on, not confirmed yet. Open a profile to confirm.' });
});

test('nav label: nothing protecting you is Visible', () => {
  assert.deepEqual(nl({}),
    { text: 'Visible', tone: 'neutral', hint: 'People see your name when you view them. Click to turn Private mode on.' });
});

test('nav label: unknown state never claims anything', () => {
  assert.deepEqual(nl({ a: { verifiedValue: null, error: false } }),
    { text: 'Not checked', tone: 'neutral', hint: "Couldn't check LinkedIn's setting. Are you signed in? Click to try turning Private mode on." });
});

test('nav label: failure is Visible!', () => {
  assert.deepEqual(nl({ fallbackFailed: true, a: { verifiedValue: null, error: true } }),
    { text: 'Visible!', tone: 'bad', hint: 'You are currently visible to profiles you view. Click to turn Private mode on.' });
});

import { bConfirmNote } from '../src/lib/status.js';

test('B on but unconfirmed explains that a profile must be opened once', () => {
  assert.equal(bConfirmNote({ enabled: true, confirmed: false }),
    'Confirms on your next profile visit.');
});

test('no confirm note when B is off or already confirmed', () => {
  assert.equal(bConfirmNote({ enabled: false, confirmed: false }), null);
  assert.equal(bConfirmNote({ enabled: true, confirmed: true }), null);
});
