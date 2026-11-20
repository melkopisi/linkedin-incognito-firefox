// Development-only logging: active only when the extension is loaded
// temporarily (about:debugging or web-ext run), silent for installed users.
// Logs are cleaned of member IDs, profile names and tracking tokens.

let enabled = false;
browser.management.getSelf().then((self) => {
  enabled = self.installType === 'development';
  browser.storage.local.set({ debugMode: enabled }); // lets content scripts log too
}, () => {});

export const debugLog = (msg) => { if (enabled) console.info(`[QPB] ${msg}`); };
export const debugEnabled = () => enabled;

const clean = (t) => t
  .replace(/urn:li:([a-zA-Z_]+):[A-Za-z0-9_-]+/g, 'urn:li:$1:<id>')
  .replace(/"(trackingId|guid|sessionId|contentTrackingId|id|vieweeMemberUrn|pageInstance|trackingToken)"\s*:\s*"[^"]*"/g, '"$1":"<x>"')
  .replace(/\/in\/[^/"?]+/g, '/in/<slug>');

export function logInspected({ kind, text, enabled: blocking, details }, rules) {
  if (!enabled) return;
  const events = [...new Set(text.match(/"eventName":"[^"]+"/g) || [])].join(',');
  debugLog(`${kind} ${blocking ? 'cancelled' : 'passed (B off)'} tab=${details.tabId} t=${Date.now()} path=${new URL(details.url).pathname} events=${events}`);
  if (kind !== 'suspicious') return;
  for (const m of rules.suspiciousMarkers) {
    const i = text.indexOf(m);
    if (i >= 0) debugLog(`around ${m}: ${clean(text.slice(Math.max(0, i - 500), i + 300))}`);
  }
}
