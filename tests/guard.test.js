import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProfileVisit, createGuard } from '../src/lib/guard.js';

test('isProfileVisit returns the lowercased slug of someone else\'s profile', () => {
  assert.equal(isProfileVisit('/in/Some-One/', 'me-myself'), 'some-one');
  assert.equal(isProfileVisit('/in/some-one/', null), 'some-one');
});

test('isProfileVisit ignores own profile, /in/me and non-profile pages', () => {
  assert.equal(isProfileVisit('/in/Me-Myself/', 'me-myself'), null);
  assert.equal(isProfileVisit('/in/me/', null), null);
  assert.equal(isProfileVisit('/feed/', null), null);
  assert.equal(isProfileVisit('/company/acme/', null), null);
});

test('a visit followed by a block inside the window does not trip', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  g.blocked(1, 500);
  assert.deepEqual(g.check(20000), []);
});

test('a visit with no block trips missed-block after the window', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  assert.deepEqual(g.check(9999), []);
  assert.deepEqual(g.check(10001), [{ reason: 'missed-block', tabId: 1, slug: 'a', time: 10001 }]);
  assert.deepEqual(g.check(20000), []);
});

test('two quick visits and one block trip once for the unblocked visit', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'first', 0);
  g.visitOpened(1, 'second', 1500);
  g.blocked(1, 1600);
  const trips = g.check(11600);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].slug, 'second');
});

test('blocks in another tab do not clear a visit', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  g.blocked(2, 100);
  assert.equal(g.check(10001).length, 1);
});

test('a suspicious report trips unrecognised-report on the next check', () => {
  const g = createGuard({ windowMs: 10000 });
  g.suspicious(3, 50);
  assert.deepEqual(g.check(60), [{ reason: 'unrecognised-report', tabId: 3, slug: null, time: 50 }]);
  assert.deepEqual(g.check(70), []);
});

test('reopening the same profile in the same tab keeps one pending visit', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  g.visitOpened(1, 'a', 200);
  g.blocked(1, 300);
  assert.deepEqual(g.check(20000), []);
});

test('reset clears pending visits', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  g.reset();
  assert.deepEqual(g.check(20000), []);
});

test('a block that arrives up to 2s before the visit is registered still counts', () => {
  const g = createGuard({ windowMs: 10000 });
  g.blocked(1, 1000);
  g.visitOpened(1, 'a', 2500);
  assert.deepEqual(g.check(20000), []);
});

test('an old unmatched block does not cover a later visit', () => {
  const g = createGuard({ windowMs: 10000 });
  g.blocked(1, 0);
  g.visitOpened(1, 'a', 5000);
  assert.equal(g.check(15001).length, 1);
});

test('profile sub-pages and overlays are not new visits', () => {
  assert.equal(isProfileVisit('/in/some-one/overlay/contact-info/', null), null);
  assert.equal(isProfileVisit('/in/some-one/details/experience/', null), null);
  assert.equal(isProfileVisit('/in/some-one/recent-activity/all/', null), null);
  assert.equal(isProfileVisit('/in/some-one', null), 'some-one');
});

test('a block with count 2 clears two pending visits', () => {
  const g = createGuard({ windowMs: 10000 });
  g.visitOpened(1, 'a', 0);
  g.visitOpened(1, 'b', 100);
  g.blocked(1, 200, 2);
  assert.deepEqual(g.check(20000), []);
});
