const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness, deferred, until, adUnitId } = require('./helpers/miniprogram-harness.cjs');

const testOptions = { timeout: 3000 };

async function beginAd(harness, page) {
  const action = page.copyResourceLink();
  await until(() => harness.calls.ads.some(ad => ad.showCalls > 0), 'rewarded ad show');
  return { action, ad: harness.calls.ads.find(ad => ad.showCalls > 0) };
}

test('loading a free resource does not show ads or expose a link to the clipboard', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
  assert.equal(h.calls.sessions.length, 0);
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  page.onUnload();
});

test('free access requests an ad session and copies only the server link after complete viewing', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  assert.deepEqual(h.calls.sessions, ['resource-a']);
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.access.length, 1);
  assert.equal(h.calls.access[0].id, 'resource-a');
  assert.ok(Object.values(h.calls.access[0].data).includes('00000000-0000-4000-8000-000000000001'));
  assert.deepEqual(h.calls.clipboard, ['https://example.invalid/unlocked']);
  assert.equal(page.data.accessing, false);
  page.onUnload();
});

for (const [label, close] of [['partial', { isEnded: false }], ['undefined', undefined], ['missing completion flag', {}], ['truthy non-boolean completion flag', { isEnded: 1 }]]) {
  test(`${label} ad close never unlocks or copies a resource`, testOptions, async () => {
    const h = createHarness();
    const page = await h.openPage();
    const { action, ad } = await beginAd(h, page);
    ad.emitClose(close);
    await action;
    assert.equal(h.calls.access.length, 0);
    assert.deepEqual(h.calls.clipboard, []);
    assert.equal(page.data.accessing, false);
    page.onUnload();
  });
}

test('SDK errors never unlock even when a stale successful close subsequently fires', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  ad.emitError();
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  page.onUnload();
});

test('access API rejection cannot fall back to resource.file_url', testOptions, async () => {
  const h = createHarness({ access: async () => { throw new Error('server rejected session'); } });
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.access.length, 1);
  assert.deepEqual(h.calls.clipboard, []);
  assert.equal(page.data.accessing, false);
  page.onUnload();
});

test('missing server resource_url is a failure even if detail carries a stale URL', testOptions, async () => {
  const h = createHarness({ access: async () => ({}) });
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  ad.emitClose({ isEnded: true });
  await action;
  assert.deepEqual(h.calls.clipboard, []);
  page.onUnload();
});

test('repeated taps while a free ad is pending create only one access attempt', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  await page.copyResourceLink();
  await page.copyResourceLink();
  assert.equal(h.calls.sessions.length, 1);
  assert.equal(ad.showCalls, 1);
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.access.length, 1);
  assert.equal(h.calls.clipboard.length, 1);
  page.onUnload();
});

test('unloading during the ad cancels pending access and ignores captured callbacks', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  const staleCloseCallbacks = [...ad.listeners.close];
  page.onUnload();
  staleCloseCallbacks.forEach(fn => fn({ isEnded: true }));
  await action;
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
});

test('unloading while session request is pending does not start an ad', testOptions, async () => {
  const pending = deferred();
  const h = createHarness({ session: () => pending.promise });
  const page = await h.openPage();
  const action = page.copyResourceLink();
  await until(() => h.calls.sessions.length === 1, 'session request');
  page.onUnload();
  pending.resolve({ session_id: 's', ad_unit_id: adUnitId, expires_at: new Date(Date.now() + 60000).toISOString() });
  await action;
  assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
});

test('unloading during final access request suppresses late clipboard side effects', testOptions, async () => {
  const pending = deferred();
  const h = createHarness({ access: () => pending.promise });
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  ad.emitClose({ isEnded: true });
  await until(() => h.calls.access.length === 1, 'access request');
  page.onUnload();
  pending.resolve({ resource_url: 'https://example.invalid/late' });
  await action;
  assert.deepEqual(h.calls.clipboard, []);
});

for (const [label, config] of [
  ['disabled configuration', async () => ({ enabled: false, ad_unit_id: adUnitId })],
  ['configuration request failure', async () => { throw new Error('offline config'); }],
  ['missing ad unit', async () => ({ enabled: true, ad_unit_id: '' })]
]) {
  test(`${label} blocks free access without fallback`, testOptions, async () => {
    const h = createHarness({ config });
    const page = await h.openPage();
    await page.copyResourceLink();
    assert.equal(h.calls.access.length, 0);
    assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
    assert.deepEqual(h.calls.clipboard, []);
    page.onUnload();
  });
}

for (const [label, session] of [
  ['different ad unit', { session_id: 's', ad_unit_id: 'adunit-other', expires_at: new Date(Date.now() + 300000).toISOString() }],
  ['expired session', { session_id: 's', ad_unit_id: adUnitId, expires_at: new Date(Date.now() - 300000).toISOString() }],
  ['invalid expiration', { session_id: 's', ad_unit_id: adUnitId, expires_at: 'not-a-date' }],
  ['missing session ID', { ad_unit_id: adUnitId, expires_at: new Date(Date.now() + 300000).toISOString() }]
]) {
  test(`${label} rejects the ticket before video playback`, testOptions, async () => {
    const h = createHarness({ session: async () => session });
    const page = await h.openPage();
    await page.copyResourceLink();
    assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
    assert.equal(h.calls.access.length, 0);
    assert.deepEqual(h.calls.clipboard, []);
    page.onUnload();
  });
}

test('unsupported SDK blocks free access', testOptions, async () => {
  const h = createHarness({ unsupported: true });
  const page = await h.openPage();
  await page.copyResourceLink();
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  page.onUnload();
});

test('failed first show can load and retry once, then still requires complete viewing', testOptions, async () => {
  const h = createHarness({ show: count => count === 1 ? Promise.reject(new Error('not loaded')) : Promise.resolve() });
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  await until(() => ad.showCalls === 2, 'retry show');
  assert.equal(ad.loadCalls, 1);
  assert.equal(h.calls.access.length, 0);
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.clipboard.length, 1);
  page.onUnload();
});

test('failed ad load produces no unlock', testOptions, async () => {
  const h = createHarness({ show: () => Promise.reject(new Error('not loaded')), load: () => Promise.reject(new Error('no fill')) });
  const page = await h.openPage();
  await page.copyResourceLink();
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  assert.equal(page.data.accessing, false);
  page.onUnload();
});

test('paid access uses confirmation and existing credits path, with no ad or ad ticket', testOptions, async () => {
  const h = createHarness({ resource: { is_free: false, credits: 10 } });
  const page = await h.openPage();
  await page.copyResourceLink();
  assert.equal(h.calls.modals.length, 1);
  assert.equal(h.calls.sessions.length, 0);
  assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
  assert.equal(h.calls.access.length, 1);
  assert.deepEqual(h.calls.clipboard, ['https://example.invalid/unlocked']);
  page.onUnload();
});

test('canceling paid confirmation neither charges nor copies', testOptions, async () => {
  const h = createHarness({ resource: { is_free: false, credits: 10 }, modal: 'cancel' });
  const page = await h.openPage();
  await page.copyResourceLink();
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  assert.equal(page.data.accessing, false);
  page.onUnload();
});

test('repeated taps while paid confirmation is open cannot charge twice', testOptions, async () => {
  const h = createHarness({ resource: { is_free: false, credits: 10 }, modal: 'manual' });
  const page = await h.openPage();
  const action = page.copyResourceLink();
  await until(() => h.calls.modals.length === 1, 'paid confirmation');
  await page.copyResourceLink();
  assert.equal(h.calls.modals.length, 1);
  h.calls.modals[0].success({ confirm: true });
  await action;
  assert.equal(h.calls.access.length, 1);
  assert.equal(h.calls.clipboard.length, 1);
  page.onUnload();
});

for (const paid of [false, true]) {
  test(`${paid ? 'paid' : 'free'} clipboard failure retries the already unlocked link without another charge or video`, testOptions, async () => {
    const h = createHarness({
      resource: paid ? { is_free: false, credits: 10 } : {},
      clipboard: (data, count) => count === 1 ? data.fail({ errMsg: 'clipboard denied' }) : data.success({})
    });
    const page = await h.openPage();
    if (paid) await page.copyResourceLink();
    else {
      const { action, ad } = await beginAd(h, page);
      ad.emitClose({ isEnded: true });
      await action;
    }
    assert.equal(page.data.copyReady, true);
    await page.copyResourceLink();
    assert.equal(h.calls.access.length, 1);
    assert.equal(h.calls.sessions.length, paid ? 0 : 1);
    assert.equal(h.calls.modals.length, paid ? 1 : 0);
    assert.deepEqual(h.calls.clipboard, ['https://example.invalid/unlocked', 'https://example.invalid/unlocked']);
    page.onUnload();
  });
}

test('retrying a failed access response reuses the completed ticket without replaying the ad', testOptions, async () => {
  let accessCount = 0;
  const h = createHarness({ access: async () => {
    accessCount += 1;
    if (accessCount === 1) throw new Error('response lost');
    return { resource_url: 'https://example.invalid/retry' };
  } });
  const page = await h.openPage();
  const { action, ad } = await beginAd(h, page);
  ad.emitClose({ isEnded: true });
  await action;
  assert.equal(h.calls.clipboard.length, 0);
  await page.copyResourceLink();
  assert.equal(h.calls.sessions.length, 1);
  assert.equal(ad.showCalls, 1);
  assert.equal(h.calls.access.length, 2);
  assert.equal(h.calls.access[0].data.ad_session_id, h.calls.access[1].data.ad_session_id);
  assert.deepEqual(h.calls.clipboard, ['https://example.invalid/retry']);
  page.onUnload();
});

test('an unlocked clipboard retry is restricted to its original resource', testOptions, async () => {
  const h = createHarness({ clipboard: (data, count) => count === 1 ? data.fail({}) : data.success({}) });
  const page = await h.openPage();
  const first = await beginAd(h, page);
  first.ad.emitClose({ isEnded: true });
  await first.action;
  page.setData({ id: 'resource-b', resource: { ...page.data.resource, id: 'resource-b' } });
  const secondAction = page.copyResourceLink();
  await until(() => first.ad.showCalls === 2, 'new resource ad');
  assert.deepEqual(h.calls.sessions, ['resource-a', 'resource-b']);
  assert.equal(h.calls.clipboard.length, 1);
  first.ad.emitClose({ isEnded: false });
  await secondAction;
  assert.equal(h.calls.access.length, 1);
  assert.equal(h.calls.clipboard.length, 1);
  page.onUnload();
});

test('successful copy is not a permanent free-unlock exemption on later requests', testOptions, async () => {
  const h = createHarness();
  const page = await h.openPage();
  const first = await beginAd(h, page);
  first.ad.emitClose({ isEnded: true });
  await first.action;
  const secondAction = page.copyResourceLink();
  await until(() => first.ad.showCalls === 2, 'second video');
  assert.equal(h.calls.sessions.length, 2);
  assert.equal(h.calls.access.length, 1);
  first.ad.emitClose({ isEnded: true });
  await secondAction;
  assert.equal(h.calls.access.length, 2);
  assert.equal(h.calls.clipboard.length, 2);
  page.onUnload();
});

test('login failure cannot start a video or copy an old detail URL', testOptions, async () => {
  const h = createHarness({ login: async () => { throw new Error('login denied'); } });
  const page = await h.openPage();
  await page.copyResourceLink();
  assert.equal(h.calls.sessions.length, 0);
  assert.equal(h.calls.ads.reduce((sum, ad) => sum + ad.showCalls, 0), 0);
  assert.equal(h.calls.access.length, 0);
  assert.deepEqual(h.calls.clipboard, []);
  page.onUnload();
});

test('a server-rejected ad receipt requires a fresh session and video on retry', testOptions, async () => {
  let attempts = 0;
  const h = createHarness({ access: async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('receipt rejected'), { statusCode: 403 });
    return { resource_url: 'https://example.invalid/fresh-session' };
  } });
  const page = await h.openPage();
  const first = await beginAd(h, page);
  first.ad.emitClose({ isEnded: true });
  await first.action;
  assert.equal(h.calls.clipboard.length, 0);
  const next = page.copyResourceLink();
  await until(() => h.calls.ads.length === 2 && h.calls.ads[1].showCalls === 1, 'fresh SDK instance');
  assert.equal(h.calls.sessions.length, 2);
  assert.equal(h.calls.access.length, 1);
  h.calls.ads[1].emitClose({ isEnded: true });
  await next;
  assert.equal(h.calls.access.length, 2);
  assert.deepEqual(h.calls.clipboard, ['https://example.invalid/fresh-session']);
  page.onUnload();
});

test('resource repriced during an ad refreshes detail and requires paid consent on retry', testOptions, async () => {
  let attempts = 0;
  const h = createHarness({ access: async () => {
    attempts += 1;
    if (attempts === 1) {
      Object.assign(h.resource, { is_free: false, credits: 10 });
      throw Object.assign(new Error('resource is now paid'), { statusCode: 400 });
    }
    return { resource_url: 'https://example.invalid/paid-after-consent' };
  } });
  const page = await h.openPage();
  const first = await beginAd(h, page);
  first.ad.emitClose({ isEnded: true });
  await first.action;
  await until(() => page.data.resource.is_paid === true, 'refreshed paid resource');
  assert.equal(h.calls.clipboard.length, 0);
  assert.equal(h.calls.modals.length, 0);
  await page.copyResourceLink();
  assert.equal(h.calls.modals.length, 1);
  assert.equal(h.calls.sessions.length, 1);
  assert.equal(h.calls.access[1].data.ad_session_id, undefined);
  assert.deepEqual(h.calls.clipboard, ['https://example.invalid/paid-after-consent']);
  page.onUnload();
});
