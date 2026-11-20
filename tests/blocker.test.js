import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlocker } from '../src/background/blocker.js';
import { fixture, rules, gz } from './helpers.js';

const details = (name, { method = 'POST', tabId = 7, gzip = true } = {}) => {
  const text = fixture(name);
  const bytes = gzip ? gz(text) : new TextEncoder().encode(text);
  return { method, tabId, url: 'https://www.linkedin.com/abcRandomPath', timeStamp: 1000, requestBody: { raw: [{ bytes: bytes.buffer }] } };
};

const setup = (enabled = true) => {
  const calls = { blocked: [], suspicious: [] };
  const blocker = createBlocker({
    rules: rules(),
    isEnabled: () => enabled,
    onBlocked: (i) => calls.blocked.push(i),
    onSuspicious: (i) => calls.suspicious.push(i),
  });
  return { blocker, calls };
};

test('enabled blocker cancels a gzip batch with the view event on an unseen path', async () => {
  const { blocker, calls } = setup();
  assert.deepEqual(await blocker.handle(details('batch-with-view.json')), { cancel: true });
  assert.equal(calls.blocked.length, 1);
  assert.equal(calls.blocked[0].tabId, 7);
  assert.equal(calls.blocked[0].viewee, 'urn:li:member:1');
});

test('disabled blocker lets everything through', async () => {
  const { blocker, calls } = setup(false);
  assert.deepEqual(await blocker.handle(details('batch-with-view.json')), {});
  assert.equal(calls.blocked.length + calls.suspicious.length, 0);
});

test('GET requests are not inspected', async () => {
  const { blocker, calls } = setup();
  assert.deepEqual(await blocker.handle(details('batch-with-view.json', { method: 'GET' })), {});
  assert.equal(calls.blocked.length, 0);
});

test('suspicious batch is cancelled and reported', async () => {
  const { blocker, calls } = setup();
  assert.deepEqual(await blocker.handle(details('batch-suspicious.json')), { cancel: true });
  assert.equal(calls.suspicious.length, 1);
  assert.equal(calls.blocked.length, 0);
});

test('unrelated batch passes', async () => {
  const { blocker } = setup();
  assert.deepEqual(await blocker.handle(details('batch-without-view.json', { gzip: false })), {});
});

test('POST without a raw body passes', async () => {
  const { blocker } = setup();
  assert.deepEqual(await blocker.handle({ method: 'POST', tabId: 1, url: 'x', requestBody: { formData: { a: ['1'] } } }), {});
});
