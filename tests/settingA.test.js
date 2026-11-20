import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettingFromHtml, readSetting, writeSetting, getCsrfToken } from '../src/lib/settingA.js';
import { fixture } from './helpers.js';

const page = (name, { status = 200, url = 'https://www.linkedin.com/mypreferences/d/profile-viewing-options' } = {}) =>
  ({ status, ok: status === 200, url, text: async () => fixture(name) });

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

test('writeSetting PUTs the value with the csrf token and verifies by reading back', async () => {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init });
    return init.method === 'PUT' ? { status: 200, ok: true } : page('settings-page-hide.html');
  };
  assert.deepEqual(await writeSetting('HIDE', { fetchFn, csrfToken: 'ajax:123' }), { ok: true, verifiedValue: 'HIDE' });
  const put = calls[0];
  assert.equal(put.url, 'https://www.linkedin.com/mysettings-api/settingsApiSettings/discloseAsProfileViewer');
  assert.equal(put.init.method, 'PUT');
  assert.equal(put.init.headers['csrf-token'], 'ajax:123');
  assert.equal(put.init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(put.init.body), { value: 'HIDE' });
  assert.equal(calls[1].url, 'https://www.linkedin.com/mypreferences/d/profile-viewing-options');
});

test('writeSetting is not ok when the read-back disagrees', async () => {
  const fetchFn = async (url, init = {}) => (init.method === 'PUT' ? { status: 200, ok: true } : page('settings-page-full.html'));
  assert.deepEqual(await writeSetting('HIDE', { fetchFn, csrfToken: 't' }), { ok: false, verifiedValue: 'DISCLOSE_FULL' });
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
