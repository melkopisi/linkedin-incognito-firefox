// Switch B: cancels LinkedIn tracking requests that carry the profile-view event.
import { decodeBody, classifyBody, extractViewee } from '../lib/matcher.js';

export function createBlocker({ rules, isEnabled, onBlocked, onSuspicious }) {
  return {
    async handle(details) {
      // tabId -1: requests the extension makes itself (setting A, own-profile lookup).
      if (details.method !== 'POST' || details.tabId === -1) return {};
      if (!isEnabled()) {
        // TEMP debug: report view signals that pass while B is off.
        const raw0 = details.requestBody && details.requestBody.raw;
        if (raw0 && raw0.length) {
          decodeBody(raw0.filter((r) => r.bytes).map((r) => new Uint8Array(r.bytes))).then((t) => {
            const k = classifyBody(t, rules);
            if (k !== 'other') console.info(`[QPB] B off, ${k} passed tab=${details.tabId} t=${Date.now()}`);
          });
        }
        return {};
      }
      const raw = details.requestBody && details.requestBody.raw;
      if (!raw || raw.length === 0) return {};
      const chunks = raw.filter((r) => r.bytes).map((r) => new Uint8Array(r.bytes));
      const text = await decodeBody(chunks);
      const kind = classifyBody(text, rules);
      if (kind === 'other') return {};
      const info = { tabId: details.tabId, viewee: extractViewee(text), url: details.url, time: details.timeStamp ?? Date.now() };
      if (kind === 'suspicious') {
        // TEMP debug: cleaned excerpt around each suspicious marker.
        const clean = (t) => t.replace(/urn:li:([a-zA-Z_]+):[A-Za-z0-9_-]+/g, 'urn:li:$1:<id>').replace(/"(trackingId|guid|sessionId|contentTrackingId|id|vieweeMemberUrn|pageInstance|trackingToken)"\s*:\s*"[^"]*"/g, '"$1":"<x>"').replace(/\/in\/[^/"?]+/g, '/in/<slug>');
        const names = [...new Set((text.match(/"eventName":"[^"]+"/g) || []))].join(',');
        const hits = rules.suspiciousMarkers.map((m) => [m, text.indexOf(m)]).filter(([, i]) => i >= 0);
        console.info(`[QPB] suspicious url=${new URL(details.url).pathname} len=${text.length} events=${names} markers=${hits.map(([m]) => m).join('|')}`);
        for (const [m, i] of hits.slice(0, 2)) console.info(`[QPB] around ${m}: ${clean(text.slice(Math.max(0, i - 500), i + 300))}`);
      }
      if (kind === 'view-signal') onBlocked(info);
      else onSuspicious(info);
      return { cancel: true };
    },
  };
}
