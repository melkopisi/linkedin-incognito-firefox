// Background entry point: connects Firefox events to the controller.
// Listeners are registered synchronously so Firefox can wake this event
// page for them.
import { createBlocker } from './blocker.js';
import { createController } from './controller.js';
import { debugLog, debugEnabled, logInspected } from './debug.js';

const controller = createController({
  storage: browser.storage.local,
  cookies: browser.cookies,
  action: browser.action,
  fetchFn: (url, init) => fetch(url, init),
});
const ready = controller.init();

const blockerReady = fetch(browser.runtime.getURL('rules/view-signal.json'))
  .then((r) => r.json())
  .then((rules) => createBlocker({
    rules,
    isEnabled: () => controller.isBEnabled(),
    onBlocked: (info) => controller.onBlocked(info),
    onSuspicious: (info) => controller.onSuspicious(info),
    onInspected: (i) => logInspected(i, rules),
    shouldInspect: debugEnabled, // installed users: nothing decoded while B is off
  }));

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    await ready;
    return (await blockerReady).handle(details);
  },
  { urls: ['*://*.linkedin.com/*'], types: ['xmlhttprequest', 'ping', 'beacon', 'other'] },
  ['blocking', 'requestBody'],
);

const navFilter = { url: [{ hostEquals: 'www.linkedin.com', pathPrefix: '/in/' }] };
const onNav = async (details) => {
  if (details.frameId !== 0) return;
  debugLog(`nav tab=${details.tabId} t=${Date.now()} path=${new URL(details.url).pathname.replace(/^\/in\/[^/]+/, '/in/<slug>')}`);
  await ready;
  controller.onNavigation(details);
};
browser.webNavigation.onCompleted.addListener(onNav, navFilter);
browser.webNavigation.onHistoryStateUpdated.addListener(onNav, navFilter);

// The user changed the setting on LinkedIn's own settings page: re-read it.
browser.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === 'PUT' && details.tabId !== -1) ready.then(() => controller.onSettingsSaved());
  },
  { urls: ['*://www.linkedin.com/mysettings-api/settingsApiSettings/discloseAsProfileViewer*'] },
);

// Signed in, out, or into another account: forget what was remembered.
let sessionTimer = null;
browser.cookies.onChanged.addListener(({ cookie }) => {
  if (!/(^|\.)linkedin\.com$/.test(cookie.domain) || !['li_at', 'JSESSIONID'].includes(cookie.name)) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => ready.then(() => controller.onSessionChanged()), 1000);
});

browser.runtime.onMessage.addListener((msg) => ready.then(() => controller.handleMessage(msg)));
