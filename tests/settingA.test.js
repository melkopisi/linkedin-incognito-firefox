import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettingFromHtml, extractSettingObject, readSetting, writeSetting, getCsrfToken } from '../src/lib/settingA.js';
import { fixture, settingsPage } from './helpers.js';

const READ = 'https://www.linkedin.com/mypreferences/d/profile-viewing-options';
const page = (name, { status = 200, url = READ } = {}) =>
  ({ status, ok: status === 200, url, text: async () => fixture(name) });
const livePage = (value) => ({ status: 200, ok: true, url: READ, text: async () => settingsPage(value) });

test('parseSettingFromHtml reads the embedded value', () => {
  assert.equal(parseSettingFromHtml(fixture('settings-page-hide.html')), 'HIDE');
  assert.equal(parseSettingFromHtml(fixture('settings-page-full.html')), 'DISCLOSE_FULL');
  assert.equal(parseSettingFromHtml(fixture('login-page.html')), null);
});

test('readSetting returns null when redirected to login', async () => {
  const fetchFn = async () => page('login-page.html', { url: 'https://www.linkedin.com/login?session_redirect=x' });
  assert.equal(await readSetting({ fetchFn }), null);
});

test('readSetting returns null when fetch rejects or status is not 200', async () => {
  assert.equal(await readSetting({ fetchFn: async () => { throw new Error('offline'); } }), null);
  assert.equal(await readSetting({ fetchFn: async () => page('settings-page-hide.html', { status: 500 }) }), null);
});

test('extractSettingObject decodes the embedded setting', () => {
  const o = extractSettingObject(settingsPage('HIDE'));
  assert.equal(o.key, 'discloseAsProfileViewer');
  assert.equal(o.value, 'HIDE');
  assert.equal(o.entityUrn, 'urn:li:settingEntity:300101');
  assert.equal(extractSettingObject(fixture('login-page.html')), null);
});

test('parseSettingFromHtml reads the live page format', () => {
  assert.equal(parseSettingFromHtml(settingsPage('HIDE')), 'HIDE');
  assert.equal(parseSettingFromHtml(settingsPage('DISCLOSE_FULL')), 'DISCLOSE_FULL');
});

test('writeSetting PUTs the full cleaned setting object with LinkedIn headers, then verifies', async () => {
  const calls = [];
  let current = 'DISCLOSE_FULL';
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init });
    if (init.method === 'PUT') { current = JSON.parse(init.body).value; return { status: 202, ok: true }; }
    return livePage(current);
  };
  assert.deepEqual(await writeSetting('HIDE', { fetchFn, csrfToken: 'ajax:123' }), { ok: true, verifiedValue: 'HIDE' });
  const put = calls.find((c) => c.init.method === 'PUT');
  assert.equal(put.url, 'https://www.linkedin.com/mysettings-api/settingsApiSettings/discloseAsProfileViewer');
  assert.equal(put.init.headers['csrf-token'], 'ajax:123');
  assert.equal(put.init.headers['x-restli-protocol-version'], '2.0.0');
  assert.equal(put.init.headers.accept, 'application/vnd.linkedin.normalized+json+2.1');
  assert.equal(put.init.headers['content-type'], 'application/json; charset=utf-8');
  const body = JSON.parse(put.init.body);
  assert.equal(body.value, 'HIDE');
  assert.equal(body.key, 'discloseAsProfileViewer');
  assert.equal(body.entityUrn, 'urn:li:settingEntity:300101');
  assert.equal(body.settingDisplayType, 'RADIO');
  assert.equal(body.hasChild, false);
  assert.ok(!JSON.stringify(body).includes('$type'));
  assert.ok(!JSON.stringify(body).includes('null'));
  assert.equal(calls.at(-1).url, READ);
});

test('writeSetting is not ok when the read-back disagrees', async () => {
  const fetchFn = async (url, init = {}) => (init.method === 'PUT' ? { status: 422, ok: false } : livePage('DISCLOSE_FULL'));
  assert.deepEqual(await writeSetting('HIDE', { fetchFn, csrfToken: 't' }), { ok: false, verifiedValue: 'DISCLOSE_FULL' });
});

test('writeSetting does not PUT when the setting object cannot be found', async () => {
  const methods = [];
  const fetchFn = async (url, init = {}) => { methods.push(init.method || 'GET'); return page('login-page.html', { url: 'https://www.linkedin.com/login' }); };
  assert.deepEqual(await writeSetting('HIDE', { fetchFn, csrfToken: 't' }), { ok: false, verifiedValue: null });
  assert.ok(!methods.includes('PUT'));
});

test('writeSetting without a csrf token does not call fetch', async () => {
  let called = false;
  const res = await writeSetting('HIDE', { fetchFn: async () => { called = true; }, csrfToken: null });
  assert.deepEqual(res, { ok: false, verifiedValue: null });
  assert.equal(called, false);
});

test('getCsrfToken strips quotes from JSESSIONID', async () => {
  const cookiesApi = { get: async ({ url, name }) => (url === 'https://www.linkedin.com' && name === 'JSESSIONID' ? { value: '"ajax:42"' } : null) };
  assert.equal(await getCsrfToken(cookiesApi), 'ajax:42');
  assert.equal(await getCsrfToken({ get: async () => null }), null);
});
