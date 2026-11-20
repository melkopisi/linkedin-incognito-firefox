// Ties switch A, switch B and the guard together. All browser APIs are
// passed in so this can be tested without Firefox.
import { readSetting, writeSetting, getCsrfToken } from '../lib/settingA.js';
import { isProfileVisit, createGuard } from '../lib/guard.js';
import { computeStatus } from '../lib/status.js';

const DEFAULTS = {
  bEnabled: false,
  tripped: false,
  fallbackFailed: false,
  historyWarningShown: false,
  tripLog: [],
  ownSlug: null,
};
const TRIP_LOG_MAX = 50;
const TRIP_TITLE = 'LinkedIn view blocking stopped working';
const TRIP_MESSAGE = 'The profile you just opened may have seen your visit. Private mode is now on (this may erase your viewer history).';
const VISIBLE_MESSAGE = 'You are currently visible to profiles you view. Turn on Private mode in LinkedIn settings.';

export function createController({ storage, cookies, action, notifications, fetchFn, now = Date.now, schedule = setTimeout, windowMs = 10000 }) {
  const guard = createGuard({ windowMs });
  let bEnabled = false; // mirrored for the synchronous webRequest check
  let bConfirmed = false; // per browser session, never stored
  let a = { verifiedValue: null, error: false };
  let tripping = false;

  const state = () => storage.get(DEFAULTS);

  async function refreshA() {
    const value = await readSetting({ fetchFn });
    a = { verifiedValue: value, error: false };
    if (value === 'HIDE') {
      const s = await state();
      if (s.fallbackFailed) await storage.set({ fallbackFailed: false });
    }
    return a;
  }

  async function snapshot(extra = {}) {
    const s = await state();
    const status = computeStatus({ a, b: { enabled: s.bEnabled, confirmed: bConfirmed }, tripped: s.tripped, fallbackFailed: s.fallbackFailed });
    await action.setBadgeText({ text: status.badge });
    if (status.badge) await action.setBadgeBackgroundColor({ color: '#d32f2f' });
    await action.setTitle({ title: status.label });
    return { status, a, b: { enabled: s.bEnabled, confirmed: bConfirmed }, tripLog: s.tripLog, ...extra };
  }

  async function setA(on, confirmedHistoryWarning) {
    const s = await state();
    if (on && !s.historyWarningShown && !confirmedHistoryWarning) {
      await refreshA();
      return snapshot({ needsHistoryWarning: true });
    }
    const csrfToken = await getCsrfToken(cookies);
    const res = await writeSetting(on ? 'HIDE' : 'DISCLOSE_FULL', { fetchFn, csrfToken });
    a = { verifiedValue: res.verifiedValue, error: !res.ok };
    const patch = {};
    if (on) patch.historyWarningShown = true;
    if (res.ok && on) patch.fallbackFailed = false;
    if (!on && res.ok) patch.tripped = false;
    await storage.set(patch);
    return snapshot();
  }

  async function setB(on) {
    bEnabled = on;
    if (!on) bConfirmed = false;
    guard.reset();
    await storage.set(on ? { bEnabled: true, tripped: false } : { bEnabled: false });
    await refreshA();
    return snapshot({ offerTurnOffA: on && a.verifiedValue === 'HIDE' });
  }

  async function trip(t) {
    bEnabled = false;
    bConfirmed = false;
    guard.reset();
    const s = await state();
    const entry = { time: t.time, reason: t.reason, path: t.slug ? `/in/${t.slug}/` : null };
    const tripLog = [...s.tripLog, entry].slice(-TRIP_LOG_MAX);
    await storage.set({ bEnabled: false, tripped: true, tripLog });
    const csrfToken = await getCsrfToken(cookies);
    const res = await writeSetting('HIDE', { fetchFn, csrfToken });
    a = { verifiedValue: res.verifiedValue, error: !res.ok };
    await storage.set({ fallbackFailed: !res.ok, historyWarningShown: true });
    await notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.svg',
      title: TRIP_TITLE,
      message: res.ok ? TRIP_MESSAGE : VISIBLE_MESSAGE,
    });
    await snapshot();
  }

  return {
    isBEnabled: () => bEnabled,

    async init() {
      const s = await state();
      bEnabled = s.bEnabled;
      if (!s.ownSlug) {
        try {
          const res = await fetchFn('https://www.linkedin.com/in/me/', { credentials: 'include' });
          const m = new URL(res.url).pathname.match(/^\/in\/([^/]+)/);
          if (m && m[1] !== 'me') await storage.set({ ownSlug: decodeURIComponent(m[1]).toLowerCase() });
        } catch {
          // signed out; try again next start
        }
      }
    },

    async handleMessage(msg) {
      switch (msg && msg.type) {
        case 'getStatus': await refreshA(); return snapshot();
        case 'setA': return setA(Boolean(msg.on), Boolean(msg.confirmedHistoryWarning));
        case 'setB': return setB(Boolean(msg.on));
        default: return undefined;
      }
    },

    async onBlocked(info) {
      if (!bConfirmed) {
        bConfirmed = true;
        await snapshot();
      }
      guard.blocked(info.tabId, now());
    },

    async onSuspicious(info) {
      guard.suspicious(info.tabId, now());
      await this.checkGuard();
    },

    async onNavigation(details) {
      if (!bEnabled) return;
      const s = await state();
      const slug = isProfileVisit(new URL(details.url).pathname, s.ownSlug);
      if (!slug) return;
      guard.visitOpened(details.tabId, slug, now());
      schedule(() => this.checkGuard(), windowMs + 100);
    },

    async checkGuard() {
      if (tripping) return;
      const trips = guard.check(now());
      if (trips.length === 0 || !bEnabled) return;
      tripping = true;
      try {
        await trip(trips[0]);
      } finally {
        tripping = false;
      }
    },
  };
}
