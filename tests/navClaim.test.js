import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Loads the content script the way Firefox does: as a plain script that
// defines a global. Each call is a separate copy (one per extension reload).
const src = readFileSync(new URL('../src/content/navClaim.js', import.meta.url), 'utf8');
const loadCopy = () => { const ctx = vm.createContext({ CustomEvent, Math }); vm.runInContext(src, ctx); return ctx.qpbClaimNav; };

class FakeDoc extends EventTarget {
  constructor() { super(); this.els = []; }
  add(id) { const el = { id, remove: () => { this.els = this.els.filter((e) => e !== el); } }; this.els.push(el); return el; }
  querySelectorAll(sel) { return this.els.filter((e) => `#${e.id}` === sel); }
}

test('a new copy removes buttons left behind by an earlier copy', () => {
  const doc = new FakeDoc();
  doc.add('qpb-nav-toggle'); doc.add('qpb-nav-toggle');
  loadCopy()(doc, 'qpb-nav-toggle', () => {});
  assert.equal(doc.querySelectorAll('#qpb-nav-toggle').length, 0);
});

test('a new copy tells the older running copy to stop, but not itself', () => {
  const doc = new FakeDoc();
  let oldStopped = 0, newStopped = 0;
  loadCopy()(doc, 'qpb-nav-toggle', () => { oldStopped++; });
  loadCopy()(doc, 'qpb-nav-toggle', () => { newStopped++; });
  assert.equal(oldStopped, 1);
  assert.equal(newStopped, 0);
});

test('a stopped copy is only told once', () => {
  const doc = new FakeDoc();
  let stopped = 0;
  loadCopy()(doc, 'qpb-nav-toggle', () => { stopped++; });
  loadCopy()(doc, 'qpb-nav-toggle', () => {});
  loadCopy()(doc, 'qpb-nav-toggle', () => {});
  assert.equal(stopped, 1);
});

test('the manifest loads the claim script before the top-bar script', () => {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(m.content_scripts[0].js, ['src/content/navClaim.js', 'src/content/navToggle.js']);
});
