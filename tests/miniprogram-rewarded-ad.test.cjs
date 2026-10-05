const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness, until, adUnitId } = require('./helpers/miniprogram-harness.cjs');

const testOptions = { timeout: 3000 };

test('multiple pages share a slot without attaching duplicate reward listeners', testOptions, async () => {
  const h = createHarness();
  const { createRewardedAd } = h.loadModule('miniprogram/utils/rewarded-ad.js');
  const first = createRewardedAd(adUnitId);
  const second = createRewardedAd(adUnitId);
  assert.equal(h.calls.ads.length, 1);
  const ad = h.calls.ads[0];
  assert.equal(ad.listeners.close.size, 1);
  assert.equal(ad.listeners.error.size, 1);
  const pending = first.watch();
  await until(() => ad.showCalls === 1);
  await assert.rejects(second.watch());
  ad.emitClose({ isEnded: true });
  await pending;
  first.destroy();
  assert.equal(ad.destroyCalls, 0);
  const next = second.watch();
  await until(() => ad.showCalls === 2);
  ad.emitClose({ isEnded: true });
  await next;
  second.destroy();
  assert.equal(ad.destroyCalls, 1);
  assert.equal(ad.listeners.close.size, 0);
  assert.equal(ad.listeners.error.size, 0);
});

test('destroyed page cannot claim a close meant for its canceled ad', testOptions, async () => {
  const h = createHarness();
  const { createRewardedAd } = h.loadModule('miniprogram/utils/rewarded-ad.js');
  const first = createRewardedAd(adUnitId);
  const second = createRewardedAd(adUnitId);
  const ad = h.calls.ads[0];
  const pending = first.watch();
  const rejection = assert.rejects(pending);
  await until(() => ad.showCalls === 1);
  first.destroy();
  await rejection;
  await assert.rejects(first.watch());
  assert.equal(second.isDestroyed(), true);
  await assert.rejects(second.watch());
  ad.emitClose({ isEnded: true });
  const reopened = createRewardedAd(adUnitId);
  const reopenedAd = h.calls.ads[1];
  const next = reopened.watch();
  await until(() => reopenedAd.showCalls === 1);
  reopenedAd.emitClose({ isEnded: false });
  await assert.rejects(next);
  second.destroy();
  reopened.destroy();
});

test('reopening after all pages close does not inherit captured stale callbacks', testOptions, async () => {
  const h = createHarness();
  const { createRewardedAd } = h.loadModule('miniprogram/utils/rewarded-ad.js');
  const first = createRewardedAd(adUnitId);
  const oldSdk = h.calls.ads[0];
  const firstWatch = first.watch();
  const rejected = assert.rejects(firstWatch);
  await until(() => oldSdk.showCalls === 1);
  const oldClose = [...oldSdk.listeners.close][0];
  first.destroy();
  await rejected;
  const second = createRewardedAd(adUnitId);
  const newSdk = h.calls.ads[1];
  let resolved = false;
  const secondWatch = second.watch().then(() => { resolved = true; });
  await until(() => newSdk.showCalls === 1);
  oldClose({ isEnded: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resolved, false);
  newSdk.emitClose({ isEnded: true });
  await secondWatch;
  second.destroy();
});

test('slot validation rejects malformed configuration before SDK creation', testOptions, () => {
  const h = createHarness();
  const { createRewardedAd } = h.loadModule('miniprogram/utils/rewarded-ad.js');
  for (const value of ['', null, 'anything', 'adunit-', 'adunit-valid\ninvalid']) assert.throws(() => createRewardedAd(value));
  assert.equal(h.calls.ads.length, 0);
});

test('SDK error retires the failed watch so its late close cannot reward a new attempt', testOptions, async () => {
  const h = createHarness();
  const { createRewardedAd } = h.loadModule('miniprogram/utils/rewarded-ad.js');
  const failed = createRewardedAd(adUnitId);
  const oldAd = h.calls.ads[0];
  const oldClose = [...oldAd.listeners.close][0];
  const oldWatch = failed.watch();
  const rejection = assert.rejects(oldWatch);
  await until(() => oldAd.showCalls === 1);
  oldAd.emitError();
  await rejection;
  assert.equal(failed.isDestroyed(), true);
  const next = createRewardedAd(adUnitId);
  const newAd = h.calls.ads[1];
  let rewarded = false;
  const newWatch = next.watch().then(() => { rewarded = true; });
  await until(() => newAd.showCalls === 1);
  oldClose({ isEnded: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rewarded, false);
  newAd.emitClose({ isEnded: true });
  await newWatch;
  next.destroy();
});
