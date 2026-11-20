// Background entry point. Prototype wiring for switch B (Task 3);
// replaced by the full controller later.
import { createBlocker } from './blocker.js';

// Listeners must be registered synchronously so Firefox can wake this
// event page for them; the rules load in parallel.
const blockerReady = fetch(browser.runtime.getURL('rules/view-signal.json'))
  .then((r) => r.json())
  .then((rules) => createBlocker({
    rules,
    isEnabled: () => enabled,
    onBlocked: (i) => console.info('[QPB] blocked view signal', i.url),
    onSuspicious: (i) => console.warn('[QPB] blocked suspicious report', i.url),
  }));

let enabled = true;
browser.storage.local.get({ bEnabled: true }).then((s) => { enabled = s.bEnabled; });
browser.storage.onChanged.addListener((c) => { if (c.bEnabled) enabled = c.bEnabled.newValue; });

browser.webRequest.onBeforeRequest.addListener(
  async (details) => (await blockerReady).handle(details),
  { urls: ['*://*.linkedin.com/*'], types: ['xmlhttprequest', 'ping', 'beacon', 'other'] },
  ['blocking', 'requestBody'],
);
