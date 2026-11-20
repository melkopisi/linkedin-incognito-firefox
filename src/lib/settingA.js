// Switch A: LinkedIn's own "Visibility when viewing other profiles" setting.

const ORIGIN = 'https://www.linkedin.com';
const PUT_URL = `${ORIGIN}/mysettings-api/settingsApiSettings/discloseAsProfileViewer`;
const READ_URL = `${ORIGIN}/mypreferences/d/profile-viewing-options`;
const VALUES = ['DISCLOSE_FULL', 'DISCLOSE_ANONYMOUS', 'HIDE'];

export function parseSettingFromHtml(html) {
  const m = html.match(/&quot;value&quot;:&quot;([A-Z_]+)&quot;,&quot;key&quot;:&quot;discloseAsProfileViewer&quot;/)
    || html.match(/"value"\s*:\s*"([A-Z_]+)"\s*,\s*"key"\s*:\s*"discloseAsProfileViewer"/);
  return m && VALUES.includes(m[1]) ? m[1] : null;
}

export async function readSetting({ fetchFn }) {
  try {
    const res = await fetchFn(READ_URL, { credentials: 'include', cache: 'no-store' });
    if (res.status !== 200) return null;
    if (/\/(login|uas\/login|checkpoint)/.test(new URL(res.url || READ_URL).pathname)) return null;
    return parseSettingFromHtml(await res.text());
  } catch {
    return null;
  }
}

export async function writeSetting(value, { fetchFn, csrfToken }) {
  if (!csrfToken) return { ok: false, verifiedValue: null };
  try {
    await fetchFn(PUT_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'csrf-token': csrfToken, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ value }),
    });
  } catch {
    // fall through to read-back; it decides the outcome
  }
  const verifiedValue = await readSetting({ fetchFn });
  return { ok: verifiedValue === value, verifiedValue };
}

export async function getCsrfToken(cookiesApi) {
  const c = await cookiesApi.get({ url: ORIGIN, name: 'JSESSIONID' });
  return c && c.value ? c.value.replace(/^"|"$/g, '') : null;
}
