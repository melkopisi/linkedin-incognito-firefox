# Privacy policy — Quiet Profile Browsing for LinkedIn

**This extension collects no data and sends no data anywhere.**

- It has no server, no analytics, and no accounts.
- It talks only to linkedin.com, from your own browser and signed-in session:
  it reads and changes your "Visibility when viewing other profiles" setting
  when you ask it to (or when its guard turns Private mode on), and it reads
  LinkedIn's outgoing tracking requests locally to cancel the one that
  reports a profile view.
- It stores, only in your browser (`storage.local`): its own switch states,
  the last value read back from LinkedIn and when, your own profile's short
  name (to ignore visits to your own profile), and a log of up to 50 guard
  warnings (time, reason, and the `/in/<name>/` path of the profile opened).
- Nothing it stores leaves your browser. Removing the extension removes it.

Not affiliated with, endorsed by, or made by LinkedIn.
