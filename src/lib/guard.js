// Guard for switch B: notices when profile visits are not followed by a
// blocked view signal, or when an unrecognised view report shows up.

const EARLY_BLOCK_GRACE_MS = 2000;

export function isProfileVisit(pathname, ownSlug) {
  const m = pathname.match(/^\/in\/([^/]+)/);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  if (slug === 'me') return null;
  if (ownSlug && slug === ownSlug.toLowerCase()) return null;
  return slug;
}

export function createGuard({ windowMs = 10000 } = {}) {
  let pending = []; // { tabId, slug, opened }
  let earlyBlocks = []; // { tabId, time } blocks with no visit yet
  let trips = [];

  return {
    visitOpened(tabId, slug, now) {
      earlyBlocks = earlyBlocks.filter((b) => now - b.time <= EARLY_BLOCK_GRACE_MS);
      const early = earlyBlocks.findIndex((b) => b.tabId === tabId);
      if (early !== -1) {
        earlyBlocks.splice(early, 1);
        return;
      }
      const dup = pending.some((p) => p.tabId === tabId && p.slug === slug && now - p.opened <= windowMs);
      if (!dup) pending.push({ tabId, slug, opened: now });
    },
    blocked(tabId, now) {
      const i = pending.findIndex((p) => p.tabId === tabId && p.opened <= now);
      if (i !== -1) pending.splice(i, 1);
      else earlyBlocks.push({ tabId, time: now });
    },
    suspicious(tabId, now) {
      trips.push({ reason: 'unrecognised-report', tabId, slug: null, time: now });
    },
    check(now) {
      const expired = pending.filter((p) => now - p.opened > windowMs);
      pending = pending.filter((p) => now - p.opened <= windowMs);
      const out = [...trips, ...expired.map((p) => ({ reason: 'missed-block', tabId: p.tabId, slug: p.slug, time: now }))];
      trips = [];
      return out;
    },
    reset() {
      pending = [];
      earlyBlocks = [];
      trips = [];
    },
  };
}
