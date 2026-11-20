import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../src/background/controller.js';
import { settingsPage } from './helpers.js';

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
    const html = settingsPage(li.value);
    return { status: 200, ok: true, url, text: async () => html };
  };
  return li;
}

function fakeBrowser(initial = {}) {
  const store = { ...initial };
  const b = {
    store,
    popupOpened: 0,
    badge: '',
    title: '',
    storage: { local: {
      get: async (defaults) => ({ ...defaults, ...store }),
      set: async (obj) => { Object.assign(store, obj); },
    } },
    cookies: { get: async () => ({ value: '"ajax:1"' }) },
    action: {
      setBadgeText: async ({ text }) => { b.badge = text; },
      setBadgeBackgroundColor: async () => {},
      setTitle: async ({ title }) => { b.title = title; },
      openPopup: async () => { b.popupOpened += 1; },
    },
  };
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
    fetchFn: li.fetchFn,
    now: () => clock,
    schedule: () => {}, // tests drive checkGuard() directly
    windowMs: 10000,
  });
  return { c, li, br, tick: (ms) => { clock += ms; } };
};

test('getStatus reuses a check from the last 10 minutes', async () => {
  const { c, li, tick } = make();
  await c.handleMessage({ type: 'getStatus' });
  tick(9 * 60 * 1000);
  await c.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, 1);
});

test('getStatus re-checks LinkedIn once the last check is over 10 minutes old', async () => {
  const { c, li, tick } = make();
  await c.handleMessage({ type: 'getStatus' });
  li.value = 'HIDE'; // changed directly on LinkedIn
  tick(10 * 60 * 1000 + 1);
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, 2);
  assert.equal(res.status.label, 'Private (verified)');
});

test('visiting LinkedIn settings forces a fresh check', async () => {
  const { c, li } = make();
  await c.handleMessage({ type: 'getStatus' });
  li.value = 'HIDE';
  await c.onSettingsVisited();
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, 2);
  assert.equal(res.status.label, 'Private (verified)');
});

test('the check is shared across restarts through storage', async () => {
  const { c, li, br } = make();
  await c.handleMessage({ type: 'getStatus' });
  const again = createController({
    storage: br.storage.local, cookies: br.cookies, action: br.action,
    fetchFn: li.fetchFn, now: () => 0, schedule: () => {},
  });
  await again.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, 1);
});

test('a switch made through the extension updates the stored check', async () => {
  const { c, li, br } = make();
  await c.handleMessage({ type: 'setA', on: true, confirmedHistoryWarning: true });
  assert.equal(br.store.aCheck.value, 'HIDE');
  const reads = li.reads;
  const res = await c.handleMessage({ type: 'getStatus' });
  assert.equal(li.reads, reads);
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

test('missed block trips: B off, A on, popup opened, ! badge, log entry', async () => {
  const { c, li, br, tick } = make({ store: { bEnabled: true } });
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(10001);
  await c.checkGuard();
  assert.equal(br.store.bEnabled, false);
  assert.deepEqual(li.puts, ['HIDE']);
  assert.equal(br.store.tripped, true);
  assert.equal(br.badge, '!');
  assert.equal(br.popupOpened, 1);
  assert.deepEqual(br.store.tripLog.map((e) => [e.reason, e.path]), [['missed-block', '/in/someone/']]);
});

test('trip with a failing fallback warns that you are visible', async () => {
  const { c, br, tick } = make({ store: { bEnabled: true }, li: { putWorks: false } });
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(10001);
  await c.checkGuard();
  assert.equal(br.store.fallbackFailed, true);
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
    storage: br.storage.local, cookies: br.cookies, action: br.action,
    fetchFn: () => new Promise(() => {}), // LinkedIn never answers
    schedule: () => {},
  });
  const result = await Promise.race([c.init().then(() => 'resolved'), new Promise((r) => setTimeout(() => r('hung'), 200))]);
  assert.equal(result, 'resolved');
  assert.equal(c.isBEnabled(), true);
});

test('a popup that cannot open does not stop the fallback', async () => {
  const { c, li, br, tick } = make({ store: { bEnabled: true } });
  br.action.openPopup = async () => { throw new Error('openPopup not allowed'); };
  await c.init();
  await c.onNavigation({ tabId: 1, url: 'https://www.linkedin.com/in/someone/' });
  tick(10001);
  await c.checkGuard();
  assert.deepEqual(li.puts, ['HIDE']);
  assert.equal(br.badge, '!');
  assert.equal(br.store.tripLog.length, 1);
});
