import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = () => JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('manifest meets AMO and design constraints', () => {
  const m = manifest();
  assert.equal(m.manifest_version, 3);
  const g = m.browser_specific_settings.gecko;
  assert.equal(g.id, 'quiet-profile-browsing@extension');
  assert.equal(g.strict_min_version, '140.0');
  assert.deepEqual(g.data_collection_permissions, { required: ['none'] });
  assert.deepEqual(m.host_permissions, ['*://*.linkedin.com/*']);
  assert.deepEqual([...m.permissions].sort(), ['cookies', 'storage', 'webNavigation', 'webRequest', 'webRequestBlocking']);
  assert.deepEqual(m.background, { scripts: ['src/background/main.js'], type: 'module' });
  assert.doesNotMatch(m.name, /^LinkedIn/);
});

test('Firefox for Android minimum is 142, where data_collection_permissions is supported', () => {
  assert.equal(manifest().browser_specific_settings.gecko_android?.strict_min_version, '142.0');
});

test('add-on icons are PNGs that exist (AMO cannot use an SVG for the listing)', () => {
  const icons = manifest().icons;
  assert.deepEqual(Object.keys(icons).sort(), ['128', '48', '96']);
  for (const [size, path] of Object.entries(icons)) {
    assert.equal(path, `icons/icon-${size}.png`);
    const png = readFileSync(new URL(`../${path}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), Number(size), `${path} width`);
  }
});
