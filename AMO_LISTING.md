# addons.mozilla.org listing

**Name:** Quiet Profile Browsing for LinkedIn

**Summary (≤250 chars):**
Look at LinkedIn profiles without showing up in "Who viewed your profile". One click switches LinkedIn's own Private mode and confirms it with LinkedIn. Optional experimental mode blocks the view signal instead. No data collected.

**Category:** Privacy & Security

**Description:**
Quiet Profile Browsing puts LinkedIn's "Private mode" one click away, in the
Firefox toolbar and in LinkedIn's top bar.

• Private mode switch — changes LinkedIn's own "Visibility when viewing
  other profiles" setting and reads it back, so the extension only says
  "Private (verified)" when LinkedIn has actually saved it. LinkedIn warns
  that Private mode may disable and erase your "Who viewed your profile"
  history; the extension shows that warning before turning it on.

• Block view signal (experimental) — keeps your settings unchanged and
  instead cancels the tracking message LinkedIn's page sends when you open a
  profile. You keep your own viewer list. It may stop working whenever
  LinkedIn changes its site, so a guard watches every profile you open: if
  it can't confirm the view signal was blocked, it turns Private mode on,
  shows a red warning on the page and in the toolbar, and switches the
  experimental mode off.

No data is collected or sent anywhere. Everything runs in your browser.
Not affiliated with, endorsed by, or made by LinkedIn.

**Privacy policy:** contents of PRIVACY.md

**Notes for reviewers:**
- Plain, unminified JavaScript; no build step, no remote code, no eval.
- `host_permissions: *://*.linkedin.com/*` — the only site it works on.
- `webRequest`, `webRequestBlocking` (with `requestBody`) — to read
  LinkedIn's outgoing tracking POSTs (gzip JSON) locally and cancel the batch
  that contains the profile-view event. Matching rules: `rules/view-signal.json`.
- `webNavigation` — to know when a profile page opens, so the guard can
  check that the view signal was blocked.
- `cookies` — to read LinkedIn's `JSESSIONID`, which LinkedIn's own
  settings API requires as its CSRF token when the extension changes the
  Private mode setting.
- `storage` — switch states, last read-back value, and a local warning log.
- Testing: sign in to LinkedIn, open the popup, toggle "Private mode"; the
  read-back is visible at linkedin.com/mypreferences/d/profile-viewing-options.
