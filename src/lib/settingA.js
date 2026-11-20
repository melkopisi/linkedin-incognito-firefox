// Switch A: LinkedIn's own "Visibility when viewing other profiles" setting.

const ORIGIN = 'https://www.linkedin.com';
const PUT_URL = `${ORIGIN}/mysettings-api/settingsApiSettings/discloseAsProfileViewer`;
const READ_URL = `${ORIGIN}/mypreferences/d/profile-viewing-options`;
const VALUES = ['DISCLOSE_FULL', 'DISCLOSE_ANONYMOUS', 'HIDE'];

// LinkedIn's settings page embeds its data as entity-encoded JSON in hidden
// <code> blocks. Returns the discloseAsProfileViewer setting object or null.
const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const findSetting = (o) => {
  if (!o || typeof o !== 'object') return null;
  if (o.key === 'discloseAsProfileViewer' && 'value' in o && o.entityUrn) return o;
  for (const k of Object.keys(o)) {
    const hit = findSetting(o[k]);
    if (hit) return hit;
  }
  return null;
};

export function extractSettingObject(html) {
  for (const m of html.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/g)) {
    if (!m[1].includes('discloseAsProfileViewer')) continue;
    try {
      const hit = findSetting(JSON.parse(decodeEntities(m[1]).trim()));
      if (hit) return hit;
    } catch {
      // not JSON; keep looking
    }
  }
  return null;
}

// Drop nulls and $type markers, as LinkedIn's own page does before saving.
const clean = (x) => {
  if (Array.isArray(x)) return x.map(clean);
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).filter(([k, v]) => v !== null && k !== '$type').map(([k, v]) => [k, clean(v)]));
  }
  return x;
};

export function parseSettingFromHtml(html) {
  const obj = extractSettingObject(html);
  if (obj && VALUES.includes(obj.value)) return obj.value;
  const m = html.match(/&quot;value&quot;:&quot;([A-Z_]+)&quot;,&quot;key&quot;:&quot;discloseAsProfileViewer&quot;/)
    || html.match(/"value"\s*:\s*"([A-Z_]+)"\s*,\s*"key"\s*:\s*"discloseAsProfileViewer"/);
  return m && VALUES.includes(m[1]) ? m[1] : null;
}

async function fetchSettingsPage(fetchFn) {
  try {
    const res = await fetchFn(READ_URL, { credentials: 'include', cache: 'no-store' });
    if (res.status !== 200) return null;
    if (/\/(login|uas\/login|checkpoint)/.test(new URL(res.url || READ_URL).pathname)) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function readSetting({ fetchFn }) {
  const html = await fetchSettingsPage(fetchFn);
  return html == null ? null : parseSettingFromHtml(html);
}

export async function writeSetting(value, { fetchFn, csrfToken }) {
  if (!csrfToken) return { ok: false, verifiedValue: null };
  const html = await fetchSettingsPage(fetchFn);
  const current = html && extractSettingObject(html);
  if (!current) return { ok: false, verifiedValue: html ? parseSettingFromHtml(html) : null };
  try {
    await fetchFn(PUT_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'csrf-token': csrfToken,
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
      },
      body: JSON.stringify({ ...clean(current), value }),
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
