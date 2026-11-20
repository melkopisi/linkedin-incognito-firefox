// What the toolbar icon and popup show. Never "protected" without a check.

export function computeStatus({ a, b, tripped, fallbackFailed }) {
  const badge = tripped ? '!' : '';
  if (fallbackFailed) return { level: 'warning', label: 'You are currently visible to profiles you view', badge: '!' };
  if (a.verifiedValue === 'HIDE') return { level: 'protected', label: 'Private (verified)', badge };
  if (b.enabled && b.confirmed) return { level: 'protected', label: 'Protected (experimental)', badge };
  if (b.enabled) return { level: 'experimental', label: 'Experimental — not yet confirmed', badge };
  if (a.error) return { level: 'unknown', label: 'Error', badge };
  if (a.verifiedValue == null) return { level: 'unknown', label: 'Unknown', badge };
  return { level: 'unprotected', label: 'Public', badge };
}
