import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBody, classifyBody, extractViewee } from '../src/lib/matcher.js';
import { fixture, rules, gz, split } from './helpers.js';

test('batch containing the profile-view event is a view-signal', () => {
  assert.equal(classifyBody(fixture('batch-with-view.json'), rules()), 'view-signal');
});

test('batch of only impression events is other', () => {
  assert.equal(classifyBody(fixture('batch-without-view.json'), rules()), 'other');
});

test('renamed view event with a viewee is suspicious', () => {
  assert.equal(classifyBody(fixture('batch-suspicious.json'), rules()), 'suspicious');
});

test('decodeBody gunzips a body split across chunks', async () => {
  const text = fixture('batch-with-view.json');
  assert.equal(await decodeBody(split(gz(text), 40)), text);
});

test('decodeBody passes plain bytes through', async () => {
  assert.equal(await decodeBody([new TextEncoder().encode('{"a":1}')]), '{"a":1}');
});

test('decodeBody returns empty string for broken gzip', async () => {
  assert.equal(await decodeBody([new Uint8Array([0x1f, 0x8b, 1, 2, 3])]), '');
});

test('extractViewee finds the viewed member urn', () => {
  assert.equal(extractViewee(fixture('batch-with-view.json')), 'urn:li:member:1');
  assert.equal(extractViewee(fixture('batch-without-view.json')), null);
});
