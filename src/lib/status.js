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

// The label in LinkedIn's top bar: says what is protecting you right now,
// in plain words. Clicking it toggles Private mode.
export function navLabel(status, a, b) {
  if (status.level === 'warning') {
    return { text: 'Visible!', tone: 'bad', hint: 'You are currently visible to profiles you view. Click to turn Private mode on.' };
  }
  if (a.verifiedValue === 'HIDE') {
    return { text: 'Private', tone: 'good', hint: 'Private mode is on (LinkedIn setting). Click to turn it off.' };
  }
  if (b.enabled && b.confirmed) {
    return { text: 'Blocking views', tone: 'good', hint: 'View signals are being blocked. Private mode is off. Click to turn Private mode on.' };
  }
  if (b.enabled) {
    return { text: 'Checking…', tone: 'pending', hint: 'Blocking is on, not confirmed yet. Open a profile to confirm.' };
  }
  if (status.level === 'unknown') {
    return { text: 'Not checked', tone: 'neutral', hint: "Couldn't check LinkedIn's setting. Are you signed in? Click to try turning Private mode on." };
  }
  return { text: 'Visible', tone: 'neutral', hint: 'People see your name when you view them. Click to turn Private mode on.' };
}
