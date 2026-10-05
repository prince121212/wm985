const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const adUnitId = 'adunit-6d5a31d80528afc5';
const sessionId = '00000000-0000-4000-8000-000000000001';
const contextArgs = { params: Promise.resolve({ id: 'resource-a' }) };
const modernHeaders = { 'X-MP-Resource-Access-Version': '1' };

// All environment and persistence are isolated. Never load project .env or real models.
function loader(mocks = {}, env = {}) {
  const cache = new Map();
  const context = vm.createContext({ Response, Request, URL, Date, process: { env }, console });
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    new vm.Script(`(function(require,module,exports){${source}\n})`, { filename }).runInContext(context)(specifier => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier === '@/lib/resp') return load('lib/resp.ts');
      if (specifier === '@/lib/mp-resource-access-policy') return load('lib/mp-resource-access-policy.ts');
      throw new Error(`Unexpected unmocked dependency: ${specifier}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}

function setup(options = {}) {
  const calls = { receipts: [], increments: [], charges: [], rewards: [], sessions: [] };
  const resource = { uuid: 'resource-a', title: 'Resource', status: 'approved', is_free: true, credits: 0,
    file_url: 'https://example.invalid/server-only', ...options.resource };
  const mocks = {
    '@/lib/logger': { log: { warn() {}, error() {} } },
    '@/lib/mp-auth': { getMpUser: async () => options.anonymous ? null : { uuid: 'user-a' } },
    '@/models/resource': {
      findResourceByUuid: async () => options.missing ? null : resource,
      incrementResourceAccess: async id => { calls.increments.push(id); },
      incrementResourceViews: async () => {},
      getResourcesList: async () => [resource], getResourcesCount: async () => 1
    },
    '@/models/mp-resource-ad': {
      completeResourceAdSession: async (...args) => {
        calls.receipts.push(args);
        if (options.receiptError) throw new Error('database unavailable');
        return options.receipt || { allowed: true, firstCompletion: true };
      },
      createResourceAdSession: async (...args) => {
        calls.sessions.push(args);
        return { id: sessionId, ad_unit_id: adUnitId, expires_at: new Date(Date.now() + 600000).toISOString() };
      }
    },
    '@/services/credit': {
      CreditsTransType: { ResourceAccess: 'access', ResourceReward: 'reward' },
      getUserCredits: async () => ({ left_credits: options.balance ?? 100 }),
      decreaseCredits: async data => { calls.charges.push(data); },
      increaseCredits: async data => { calls.rewards.push(data); }
    },
    '@/models/favorite': { getUserFavorites: async () => [{ id: 1, resource }] },
    '@/models/category': { findCategoryByName: async () => null },
    '@/models/tag': { getResourceTags: async () => [] },
    '@/models/db': { getSupabaseClient: () => { throw new Error('unexpected DB call'); }, withRetry: fn => fn() },
    '@/lib/hash': { getUuid: () => 'not-used' }
  };
  return { calls, resource, load: loader(mocks, options.env || {}) };
}

function request(body = {}, legacy = false) {
  return new Request('https://local.invalid/api/mp/resources/resource-a/access', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(legacy ? {} : modernHeaders) }, body: JSON.stringify(body)
  });
}

async function access(harness, body, req) {
  const route = harness.load('app/api/mp/resources/[id]/access/route.ts');
  const response = await route.POST(req || request(body), contextArgs);
  return { response, body: await response.json() };
}

test('free access requires authentication before accepting an ad receipt', async () => {
  const h = setup({ anonymous: true });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 401);
  assert.equal(h.calls.receipts.length, 0);
  assert.equal(h.calls.increments.length, 0);
  assert.equal(result.body.data, undefined);
});

for (const [name, body] of [
  ['missing receipt', {}], ['client completion flag without receipt', { ad_completed: true }],
  ['incomplete view', { ad_session_id: sessionId, ad_completed: false }],
  ['truthy non-boolean flag', { ad_session_id: sessionId, ad_completed: 'true' }]
]) {
  test(`free access rejects ${name}`, async () => {
    const h = setup();
    const result = await access(h, body);
    assert.equal(result.response.status, 403);
    assert.equal(result.body.data, undefined);
    assert.equal(h.calls.receipts.length, 0);
    assert.equal(h.calls.increments.length, 0);
  });
}

test('malformed JSON cannot fall back to unguarded free access', async () => {
  const h = setup();
  const result = await access(h, null, new Request('https://local.invalid/', { method: 'POST', body: '{broken' }));
  assert.equal(result.response.status, 400);
  assert.equal(result.body.data, undefined);
  assert.equal(h.calls.increments.length, 0);
});

test('legacy free access retains the installed client protocol without advertising completion', async () => {
  const h = setup({ anonymous: true });
  const result = await access(h, null, request({}, true));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.resource_url, h.resource.file_url);
  assert.equal(result.body.data.message, '访问记录成功');
  assert.equal(h.calls.receipts.length, 0);
  assert.deepEqual(h.calls.increments, ['resource-a']);
});

test('legacy paid access still requires login and sufficient credits', async () => {
  const anonymous = setup({ anonymous: true, resource: { is_free: false, credits: 10 } });
  assert.equal((await access(anonymous, null, request({}, true))).response.status, 401);
  assert.equal(anonymous.calls.charges.length, 0);
  const paid = setup({ resource: { is_free: false, credits: 10 } });
  const result = await access(paid, null, request({}, true));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.resource_url, paid.resource.file_url);
  assert.equal(paid.calls.charges.length, 1);
});

for (const body of [
  { ad_session_id: '' }, { ad_session_id: null }, { ad_completed: false },
  { ad_session_id: sessionId, ad_completed: false }
]) {
  test(`ad claims cannot downgrade to legacy access when the version header is absent: ${JSON.stringify(body)}`, async () => {
    const h = setup();
    const result = await access(h, null, request(body, true));
    assert.equal(result.response.status, 403);
    assert.equal(result.body.data, undefined);
    assert.equal(h.calls.receipts.length, 0);
    assert.equal(h.calls.increments.length, 0);
  });
}

test('completed ad claims without a version header still validate their receipt', async () => {
  const h = setup({ receipt: { allowed: false, firstCompletion: false } });
  const result = await access(h, null, request({ ad_session_id: sessionId, ad_completed: true }, true));
  assert.equal(result.response.status, 403);
  assert.deepEqual(h.calls.receipts, [[sessionId, 'user-a', 'resource-a', adUnitId]]);
  assert.equal(h.calls.increments.length, 0);
});

test('closing the legacy compatibility window rejects free access without a receipt', async () => {
  const h = setup({ env: { MP_ALLOW_LEGACY_RESOURCE_ACCESS: 'false' } });
  const result = await access(h, null, request({}, true));
  assert.equal(result.response.status, 403);
  assert.equal(result.body.data, undefined);
  assert.equal(h.calls.increments.length, 0);
});

for (const version of ['', '0', 'unexpected']) {
  test(`an invalid or unknown version header never enables legacy access: ${JSON.stringify(version)}`, async () => {
    const req = request({}, true);
    req.headers.set('X-MP-Resource-Access-Version', version);
    const result = await access(setup(), null, req);
    assert.equal(result.response.status, 403);
    assert.equal(result.body.data, undefined);
  });
}

test('foreign, expired, or otherwise rejected receipts cannot reveal the URL', async () => {
  const h = setup({ receipt: { allowed: false, firstCompletion: false } });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 403);
  assert.equal(h.calls.receipts.length, 1);
  assert.equal(h.calls.increments.length, 0);
  assert.equal(result.body.data, undefined);
});

test('valid first completion is bound to user, resource, and configured slot and counts once', async () => {
  const h = setup();
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.body.data.resource_url, h.resource.file_url);
  assert.deepEqual(h.calls.receipts, [[sessionId, 'user-a', 'resource-a', adUnitId]]);
  assert.deepEqual(h.calls.increments, ['resource-a']);
  assert.equal(h.calls.charges.length, 0);
});

test('completed receipt retry returns the same URL without another access count', async () => {
  const h = setup({ receipt: { allowed: true, firstCompletion: false } });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.resource_url, h.resource.file_url);
  assert.equal(h.calls.increments.length, 0);
});

test('disabled remote policy fails closed', async () => {
  const h = setup({ env: { MP_REWARDED_AD_ENABLED: 'false' } });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 403);
  assert.equal(h.calls.receipts.length, 0);
  assert.equal(result.body.data, undefined);
});

test('receipt storage failure never reveals resource URL', async () => {
  const h = setup({ receiptError: true });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.data, undefined);
  assert.equal(h.calls.increments.length, 0);
});

test('paid resource retains one debit and author credit per access request without ad calls', async () => {
  const h = setup({ resource: { is_free: false, credits: 10, author_id: 'author-b' } });
  const result = await access(h, {});
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.credits_cost, 10);
  assert.equal(result.body.data.resource_url, h.resource.file_url);
  assert.equal(h.calls.receipts.length, 0);
  assert.equal(h.calls.charges.length, 1);
  assert.equal(h.calls.charges[0].credits, 10);
  assert.equal(h.calls.rewards.length, 1);
  assert.equal(h.calls.rewards[0].user_uuid, 'author-b');
});

test('resource repriced during an ad cannot silently debit credits', async () => {
  const h = setup({ resource: { is_free: false, credits: 10 } });
  const result = await access(h, { ad_session_id: sessionId, ad_completed: true });
  assert.equal(result.response.status, 400);
  assert.equal(h.calls.charges.length, 0);
  assert.equal(h.calls.increments.length, 0);
  assert.equal(result.body.data, undefined);
});

test('paid insufficient balance neither charges nor reveals the link', async () => {
  const h = setup({ resource: { is_free: false, credits: 10 }, balance: 5 });
  const result = await access(h, {});
  assert.equal(result.response.status, 403);
  assert.equal(result.body.data, undefined);
  assert.equal(h.calls.charges.length, 0);
});

for (const [label, file, extractor] of [
  ['detail', 'app/api/mp/resources/[id]/route.ts', data => data.resource],
  ['list', 'app/api/mp/resources/route.ts', data => data.resources[0]],
  ['favorites', 'app/api/mp/my/favorites/route.ts', data => data.favorites[0].resource]
]) {
  test(`mini-program ${label} returns browse metadata without a resource URL`, async () => {
    const h = setup();
    const response = await h.load(file).GET(new Request('https://local.invalid/', { headers: modernHeaders }), contextArgs);
    assert.equal(response.status, 200);
    const resource = extractor((await response.json()).data);
    assert.equal(resource.uuid, 'resource-a');
    assert.equal(resource.ad_required, true);
    assert.equal(Object.hasOwn(resource, 'file_url'), false);
    assert.equal(h.resource.file_url, 'https://example.invalid/server-only', 'serializer must not mutate source record');
  });

  for (const paid of [false, true]) {
    test(`legacy ${label} preserves the ${paid ? 'paid' : 'free'} URL required by the installed client`, async () => {
      const h = setup({ resource: { is_free: !paid, credits: paid ? 10 : 0 } });
      const response = await h.load(file).GET(new Request('https://local.invalid/'), contextArgs);
      const resource = extractor((await response.json()).data);
      assert.equal(resource.file_url, h.resource.file_url);
      assert.equal(resource.ad_required, false);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('Vary'), 'X-MP-Resource-Access-Version');
    });
  }

  test(`closing the legacy window redacts ${label} even without a version header`, async () => {
    const h = setup({ env: { MP_ALLOW_LEGACY_RESOURCE_ACCESS: 'false' } });
    const response = await h.load(file).GET(new Request('https://local.invalid/'), contextArgs);
    const resource = extractor((await response.json()).data);
    assert.equal(Object.hasOwn(resource, 'file_url'), false);
    assert.equal(resource.ad_required, true);
  });
}

test('ad session creation returns only receipt metadata, never a download URL', async () => {
  const h = setup();
  const response = await h.load('app/api/mp/resources/[id]/ad-session/route.ts').POST(request(), contextArgs);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.data.session_id, sessionId);
  assert.deepEqual(Object.keys(body.data).sort(), ['ad_unit_id', 'expires_at', 'session_id']);
  assert.deepEqual(h.calls.sessions, [['user-a', 'resource-a', adUnitId]]);
});

for (const [label, options, status] of [
  ['anonymous user', { anonymous: true }, 401],
  ['paid resource', { resource: { is_free: false, credits: 10 } }, 400],
  ['unapproved resource', { resource: { status: 'pending' } }, 404],
  ['missing resource link', { resource: { file_url: '' } }, 404],
  ['disabled ads', { env: { MP_REWARDED_AD_ENABLED: 'false' } }, 403]
]) {
  test(`cannot create an ad session for ${label}`, async () => {
    const h = setup(options);
    const response = await h.load('app/api/mp/resources/[id]/ad-session/route.ts').POST(request(), contextArgs);
    assert.equal(response.status, status);
    assert.equal(h.calls.sessions.length, 0);
  });
}

test('public config uses known slot by default and supports remote disable and slot changes', () => {
  assert.equal(loader()('lib/mp-resource-access-policy.ts').mpAdConfig().ad_unit_id, adUnitId);
  const disabled = loader({}, { MP_REWARDED_AD_ENABLED: 'false' })('lib/mp-resource-access-policy.ts').mpAdConfig();
  assert.equal(disabled.enabled, false);
  const changed = loader({}, { MP_REWARDED_AD_UNIT_ID: 'adunit-NewSlot' })('lib/mp-resource-access-policy.ts').mpAdConfig();
  assert.equal(changed.enabled, true);
  assert.equal(changed.ad_unit_id, 'adunit-NewSlot');
  assert.equal(loader({}, { MP_REWARDED_AD_UNIT_ID: 'malformed' })('lib/mp-resource-access-policy.ts').mpAdConfig().enabled, false);
});

test('public serializer removes file_url for both free and paid resources', () => {
  const policy = loader()('lib/mp-resource-access-policy.ts');
  for (const resource of [{ is_free: true, credits: 0 }, { is_free: false, credits: 10 }]) {
    const result = policy.publicMpResource({ ...resource, file_url: 'private', title: 'retained' });
    assert.equal(Object.hasOwn(result, 'file_url'), false);
    assert.equal(result.title, 'retained');
    assert.equal(result.ad_required, resource.is_free);
  }
  assert.equal(policy.resourceCreditsCost({ is_free: false, credits: Infinity }), 0);
  assert.equal(policy.resourceCreditsCost({ is_free: false, credits: -1 }), 0);
});

const now = Date.parse('2026-10-05T08:00:00.000Z');
const validSession = {
  id: sessionId, user_uuid: 'user-a', resource_uuid: 'resource-a', ad_unit_id: adUnitId,
  created_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 599000).toISOString(), completed_at: null
};

test('session validation accepts only currently live bounded receipts', () => {
  const policy = loader()('lib/mp-resource-access-policy.ts');
  assert.equal(policy.validResourceAdSession(validSession, 'user-a', 'resource-a', adUnitId, now), true);
  assert.equal(policy.validResourceAdSession({ ...validSession, completed_at: new Date(now).toISOString() }, 'user-a', 'resource-a', adUnitId, now), true);
});

for (const [label, session] of [
  ['missing', null], ['different user', { ...validSession, user_uuid: 'other' }],
  ['different resource', { ...validSession, resource_uuid: 'other' }],
  ['different ad slot', { ...validSession, ad_unit_id: 'adunit-other' }],
  ['expired', { ...validSession, expires_at: new Date(now).toISOString() }],
  ['future created date', { ...validSession, created_at: new Date(now + 100).toISOString() }],
  ['unbounded lifetime', { ...validSession, expires_at: new Date(now + 3600000).toISOString() }],
  ['invalid timestamp', { ...validSession, expires_at: 'invalid' }]
]) {
  test(`session validation rejects ${label} receipt`, () => {
    const policy = loader()('lib/mp-resource-access-policy.ts');
    assert.equal(policy.validResourceAdSession(session, 'user-a', 'resource-a', adUnitId, now), false);
  });
}
