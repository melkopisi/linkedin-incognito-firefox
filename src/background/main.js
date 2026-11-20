// Background entry point: connects Firefox events to the controller.
// Listeners are registered synchronously so Firefox can wake this event
// page for them.
import { createBlocker } from './blocker.js';
import { createController } from './controller.js';

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
    onBlocked: (info) => { console.info(`[QPB] blocked view signal tab=${info.tabId} t=${Date.now()}`); controller.onBlocked(info); },
    onSuspicious: (info) => { console.info(`[QPB] suspicious report tab=${info.tabId} t=${Date.now()}`); controller.onSuspicious(info); },
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
  console.info(`[QPB] nav tab=${details.tabId} t=${Date.now()} path=${new URL(details.url).pathname.replace(/^\/in\/[^/]+/, '/in/<slug>')}`);
  await ready;
  controller.onNavigation(details);
};
browser.webNavigation.onCompleted.addListener(onNav, navFilter);
browser.webNavigation.onHistoryStateUpdated.addListener(onNav, navFilter);

browser.webNavigation.onCompleted.addListener(
  () => ready.then(() => controller.onSettingsVisited()),
  { url: [{ hostEquals: 'www.linkedin.com', pathPrefix: '/mypreferences/' }, { hostEquals: 'www.linkedin.com', pathPrefix: '/psettings/' }] },
);

browser.runtime.onMessage.addListener((msg) => ready.then(() => controller.handleMessage(msg)));
