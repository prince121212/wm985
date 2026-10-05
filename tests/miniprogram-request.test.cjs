const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const requests = [];
  const module = { exports: {} };
  const wx = {
    getStorageSync: () => 'test-session-token',
    request: options => requests.push(options)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/utils/request.js'), 'utf8'), {
    wx, module, require: () => ({ API_BASE_URL: 'https://local.invalid' }), Promise, Error
  });
  return { request: module.exports.request, requests };
}

for (const auth of [true, false]) {
  test(`all ${auth ? 'authenticated' : 'public'} requests advertise the resource access protocol`, async () => {
    const h = setup();
    const pending = h.request({ url: '/api/mp/resources', auth });
    const options = h.requests[0];
    assert.equal(options.header['X-MP-Resource-Access-Version'], '1');
    assert.equal(options.header.Authorization, auth ? 'Bearer test-session-token' : undefined);
    options.success({ statusCode: 200, data: { code: 0, data: { ok: true } } });
    assert.deepEqual(await pending, { ok: true });
  });
}

test('ad rejection is surfaced without retrying through the old protocol', async () => {
  const h = setup();
  const pending = h.request({ url: '/api/mp/resources/example/access', method: 'POST' });
  h.requests[0].success({ statusCode: 403, data: { code: 1003, message: '请完整观看激励视频后获取资源' } });
  await assert.rejects(pending, error => error.statusCode === 403 && error.code === 1003);
  assert.equal(h.requests.length, 1);
});
