// Switch B: cancels LinkedIn tracking requests that carry the profile-view event.
import { decodeBody, classifyBody, extractViewee } from '../lib/matcher.js';

export function createBlocker({ rules, isEnabled, onBlocked, onSuspicious }) {
  return {
    async handle(details) {
      if (!isEnabled() || details.method !== 'POST') return {};
      const raw = details.requestBody && details.requestBody.raw;
      if (!raw || raw.length === 0) return {};
      const chunks = raw.filter((r) => r.bytes).map((r) => new Uint8Array(r.bytes));
      const text = await decodeBody(chunks);
      const kind = classifyBody(text, rules);
      if (kind === 'other') return {};
      const info = { tabId: details.tabId, viewee: extractViewee(text), url: details.url, time: details.timeStamp ?? Date.now() };
      if (kind === 'view-signal') onBlocked(info);
      else onSuspicious(info);
      return { cancel: true };
    },
  };
}
