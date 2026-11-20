# Quiet Profile Browsing for LinkedIn

A Firefox extension for viewing LinkedIn profiles without appearing in
"Who viewed your profile".

- **Private mode (A):** one click flips LinkedIn's own Private mode setting
  and reads it back to confirm. Available in the toolbar popup and as a small
  switch in LinkedIn's top bar (its colour shows your overall protection).
- **Block view signal (B, experimental):** cancels the tracking message
  LinkedIn sends when a profile opens, so your settings and viewer list stay
  as they are.
- **Guard:** with B on, every profile visit must be followed by a blocked
  view signal within 30 seconds, and no unrecognised view report may appear.
  Otherwise B turns off, Private mode turns on, and a red banner, a red `!`
  on the icon and the popup warn you.

Design: `docs/superpowers/specs/2026-11-20-linkedin-incognito-firefox-design.md`

## Develop and test

```bash
npm install
npm test
npm run lint
npm start   # Firefox with the extension loaded, using the ./dev profile
```

Or load it by hand: `about:debugging` → This Firefox → Load Temporary
Add-on… → pick `manifest.json`.

## When LinkedIn changes things

B recognises the view event by content, in `rules/view-signal.json`:

- `viewMarkers` — strings that identify the profile-view event; a request
  containing one is cancelled.
- `suspiciousMarkers` — strings that suggest a view report in an unknown
  format; such a request is cancelled and the guard trips.

Update the markers, bump `version` in `manifest.json`, run the tests, and
publish a new version.

Private mode (A) depends on LinkedIn's settings page
(`/mypreferences/d/profile-viewing-options`) embedding the setting as JSON,
and on `PUT /mysettings-api/settingsApiSettings/discloseAsProfileViewer`
accepting the full setting object with rest.li headers. See
`src/lib/settingA.js`.

## Publish on addons.mozilla.org

```bash
npm run build
```

Upload the zip from `web-ext-artifacts/` at
addons.mozilla.org → Developer Hub → Submit a New Add-on → "On this site".
Copy the listing text from `AMO_LISTING.md` and the privacy policy from
`PRIVACY.md`.
