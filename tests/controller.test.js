import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../src/background/controller.js';
import { fixture } from './helpers.js';

// Fake LinkedIn: holds the setting, answers PUT and the read-back page.
function fakeLinkedIn({ value = 'DISCLOSE_FULL', putWorks = true, ownSlug = 'me-myself' } = {}) {
  const li = { value, puts: [], reads: 0 };
  li.fetchFn = async (url, init = {}) => {
    if (init.method === 'PUT') {
      li.puts.push(JSON.parse(init.body).value);
      if (putWorks) li.value = JSON.parse(init.body).value;
      return { status: 200, ok: true };
    }
    if (url.endsWith('/in/me/')) return { status: 200, ok: true, url: `https://www.linkedin.com/in/${ownSlug}/`, text: async () => '' };
    li.reads += 1;
    const html = fixture('settings-page-full.html').replace('DISCLOSE_FULL', li.value);
    return { status: 200, ok: true, url, text: async () => html };
  };
  return li;
}

function fakeBrowser(initial = {}) {
  const store = { ...initial };
  const b = {
    store,
    notifications: [],
    badge: '',
    title: '',
    storage: { local: {
      get: async (defaults) => ({ ...defaults, ...store }),
      set: async (obj) => { Object.assign(store, obj); },
    } },
    cookies: { get: async () => ({ value: '"ajax:1"' }) },
    notifications_api: null,
    action: {
      setBadgeText: async ({ text }) => { b.badge = text; },
      setBadgeBackgroundColor: async () => {},
      setTitle: async ({ title }) => { b.title = title; },
    },
  };
  b.notificationsApi = { create: async (opts) => { b.notifications.push(opts); } };
  return b;
}

const make = (opts = {}) => {
  const li = fakeLinkedIn(opts.li);
  const br = fakeBrowser(opts.store);
  let clock = 0;
  const c = createController({
    storage: br.storage.local,
    cookies: br.cookies,
    action: br.action,
    notifications: br.notificationsApi,
    fetchFn: li.fetchFn,
    now: () => clock,
    schedule: () => {}, // tests drive checkGuard() directly
    windowMs: 10000,
  });
  return { c, li, br, tick: (ms) => { clock += ms; } };
};

test('getStatus re-reads LinkedIn every time', async () => {
  const { c, li } = make();
  await c.handleMessage({ type: 'getStatus' });
  li.value = 'HIDE'; // changed directly on LinkedIn
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, 2);
  assert.equal(res.status.label, 'Private (verified)');
});

test('first setA on asks for the history warning and writes nothing', async () => {
  const { c, li } = make();
  const res = await c.handleMessage({ type: 'setA', on: true });
  assert.equal(res.needsHistoryWarning, true);
  assert.deepEqual(li.puts, []);
});

test('setA on with confirmation writes HIDE and remembers the warning', async () => {
  const { c, li, br } = make();
  const res = await c.handleMessage({ type: 'setA', on: true, confirmedHistoryWarning: true });
  assert.deepEqual(li.puts, ['HIDE']);
  assert.equal(res.status.label, 'Private (verified)');
  assert.equal(br.store.historyWarningShown, true);
  await c.handleMessage({ type: 'setA', on: false });
  const again = await c.handleMessage({ type: 'setA', on: true });
  assert.notEqual(again.needsHistoryWarning, true);
  assert.deepEqual(li.puts, ['HIDE', 'DISCLOSE_FULL', 'HIDE']);
});

test('setB on while A is HIDE offers to turn A off', async () => {
  const { c } = make({ li: { value: 'HIDE' } });
  const res = await c.handleMessage({ type: 'setB', on: true });
  assert.equal(res.offerTurnOffA, true);
  assert.equal(res.b.enabled, true);
});

test('B shows unconfirmed until a block is seen', async () => {
  const { c } = make();
  let res = await c.handleMessage({ type: 'setB', on: true });
  assert.equal(res.status.label, 'Experimental — not yet confirmed');
  await c.onBlocked({ tabId: 1, time: 0 });
  res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(res.status.label, 'Protected (experimental)');
});

test('own profile visit does not trip the guard', async () => {
  const { c, tick, li } = make({ store: { bEnabled: true } });
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/me-myself/' });
  tick(20000);
  await c.checkGuard();
  assert.deepEqual(li.puts, []);
});

test('missed block trips: B off, A on, notification, ! badge, log entry', async () => {
  const { c, li, br, tick } = make({ store: { bEnabled: true } });
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(10001);
  await c.checkGuard();
  assert.equal(br.store.bEnabled, false);
  assert.deepEqual(li.puts, ['HIDE']);
  assert.equal(br.store.tripped, true);
  assert.equal(br.badge, '!');
  assert.equal(br.notifications.length, 1);
  assert.equal(br.notifications[0].title, 'LinkedIn view blocking stopped working');
  assert.match(br.notifications[0].message, /may have seen your visit/);
  assert.deepEqual(br.store.tripLog.map((e) => [e.reason, e.path]), [['missed-block', '/in/someone/']]);
});

test('trip with a failing fallback warns that you are visible', async () => {
  const { c, br, tick } = make({ store: { bEnabled: true }, li: { putWorks: false } });
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(10001);
  await c.checkGuard();
  assert.equal(br.store.fallbackFailed, true);
  assert.match(br.notifications[0].message, /You are currently visible to profiles you view/);
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(res.status.level, 'warning');
});

test('fallbackFailed clears once LinkedIn reads back HIDE', async () => {
  const { c, li, br } = make({ store: { fallbackFailed: true } });
  li.value = 'HIDE';
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(br.store.fallbackFailed, false);
  assert.equal(res.status.label, 'Private (verified)');
});

test('suspicious report trips immediately on next check', async () => {
  const { c, li } = make({ store: { bEnabled: true } });
  await c.init();
  await c.onSuspicious({ tabId: 1, time: 0 });
  await c.checkGuard();
  assert.deepEqual(li.puts, ['HIDE']);
});

test('trip log keeps the newest 50 entries', async () => {
  const old = Array.from({ length: 50 }, (_, i) => ({ time: i, reason: 'missed-block', path: '/in/x/' }));
  const { c, br } = make({ store: { bEnabled: true, tripLog: old } });
  await c.init();
  await c.onSuspicious({ tabId: 1, time: 99 });
  await c.checkGuard();
  assert.equal(br.store.tripLog.length, 50);
  assert.equal(br.store.tripLog.at(-1).reason, 'unrecognised-report');
});

test('guard does nothing while B is off', async () => {
  const { c, li, tick } = make();
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(20000);
  await c.checkGuard();
  assert.deepEqual(li.puts, []);
});

test('init resolves without waiting for the own-profile lookup', async () => {
  const br = fakeBrowser({ bEnabled: true });
  const c = createController({
    storage: br.storage.local, cookies: br.cookies, action: br.action, notifications: br.notificationsApi,
    fetchFn: () => new Promise(() => {}), // LinkedIn never answers
    schedule: () => {},
  });
  const result = await Promise.race([c.init().then(() => 'resolved'), new Promise((r) => setTimeout(() => r('hung'), 200))]);
  assert.equal(result, 'resolved');
  assert.equal(c.isBEnabled(), true);
});
