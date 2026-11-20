// Switch B: cancels LinkedIn tracking requests that carry the profile-view event.
import { decodeBody, classifyBody, extractViewee } from '../lib/matcher.js';

// onInspected (optional, used for development logging) receives every
// recognised body, including while blocking is off.
export function createBlocker({ rules, isEnabled, onBlocked, onSuspicious, onInspected = null, shouldInspect = () => Boolean(onInspected) }) {
  return {
    async handle(details) {
      // tabId -1: requests the extension makes itself (setting A, own-profile lookup).
      if (details.method !== 'POST' || details.tabId === -1) return {};
      const enabled = isEnabled();
      const inspect = Boolean(onInspected) && shouldInspect();
      if (!enabled && !inspect) return {};
      const raw = details.requestBody && details.requestBody.raw;
      if (!raw || raw.length === 0) return {};
      const text = await decodeBody(raw.filter((r) => r.bytes).map((r) => new Uint8Array(r.bytes)));
      const kind = classifyBody(text, rules);
      if (kind === 'other') return {};
      if (inspect) onInspected({ kind, text, enabled, details });
      if (!enabled) return {};
      const info = { tabId: details.tabId, viewee: extractViewee(text), url: details.url, time: details.timeStamp ?? Date.now() };
      if (kind === 'view-signal') onBlocked(info);
      else onSuspicious(info);
      return { cancel: true };
    },
  };
}
