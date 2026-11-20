import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
export const rules = () => JSON.parse(readFileSync(new URL('../rules/view-signal.json', import.meta.url), 'utf8'));
export const gz = (text) => new Uint8Array(gzipSync(Buffer.from(text)));
export const split = (bytes, at) => [bytes.slice(0, at), bytes.slice(at)];

// A settings page like LinkedIn's: the setting object is embedded as
// entity-encoded JSON inside a hidden <code> block.
export function settingsPage(value) {
  const setting = {
    settingDisplayType: 'RADIO', a11yDescription: null, description: 'Select what others see', offValue: 'HIDE',
    entityUrn: 'urn:li:settingEntity:300101', value, key: 'discloseAsProfileViewer', onValue: 'DISCLOSE_FULL',
    childSettings: null, $type: 'com.linkedin.settingsapi.Setting', hasChild: false,
    settingDisplayValues: [
      { settingDisplayValue: 'Your name and headline', value: 'DISCLOSE_FULL', selected: value === 'DISCLOSE_FULL', $type: 'com.linkedin.settingsapi.SettingDisplayValue' },
      { settingDisplayValue: 'Private mode', value: 'HIDE', selected: value === 'HIDE', $type: 'com.linkedin.settingsapi.SettingDisplayValue' },
    ],
  };
  const enc = JSON.stringify({ data: { other: 1 }, included: [setting] }).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/=/g, '&#61;');
  return `<html><body><code style="display: none" id="bpr-guid-1">\n  ${enc}\n</code></body></html>`;
}
