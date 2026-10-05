const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const adUnitId = 'adunit-6d5a31d80528afc5';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function until(predicate, label = 'async state') {
  for (let i = 0; i < 40; i += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), `Did not reach ${label}`);
}

function createHarness(options = {}) {
  const calls = { clipboard: [], modals: [], toasts: [], ads: [], access: [], sessions: [], config: 0, logins: 0 };
  const defaults = {
    id: 'resource-a', title: 'A resource', is_free: true, credits: 0,
    // Deliberately retain a stale link to ensure failures never fall back to it.
    file_url: 'https://example.invalid/unguarded-stale-link'
  };
  const resource = { ...defaults, ...options.resource };
  const api = {
    async resourceDetail() { return { resource }; },
    async favoriteStatus() { return { favorited: false }; },
    async resourceRating() { return { rating: 0, has_rated: false }; },
    async resourceComments() { return { comments: [], total: 0 }; },
    async adConfig() {
      calls.config += 1;
      return options.config ? options.config() : { enabled: true, ad_unit_id: adUnitId, policy_version: 1 };
    },
    async createResourceAdSession(id) {
      calls.sessions.push(id);
      return options.session ? options.session(id) : {
        session_id: '00000000-0000-4000-8000-000000000001', ad_unit_id: adUnitId,
        expires_at: new Date(Date.now() + 300000).toISOString()
      };
    },
    async accessResource(id, data) {
      calls.access.push({ id, data });
      return options.access ? options.access(id, data) : { resource_url: 'https://example.invalid/unlocked' };
    }
  };
  const auth = {
    async ensureLogin() {
      calls.logins += 1;
      return options.login ? options.login() : { token: 'test-token', user: { uuid: 'test-user' } };
    }
  };
  const wx = {
    showToast(data) { calls.toasts.push(data); },
    showLoading() {},
    hideLoading() {},
    showModal(data) {
      calls.modals.push(data);
      if (options.modal !== 'manual') data.success({ confirm: options.modal !== 'cancel', cancel: options.modal === 'cancel' });
    },
    setClipboardData(data) {
      calls.clipboard.push(data.data);
      if (options.clipboard) options.clipboard(data, calls.clipboard.length);
      else if (data.success) data.success({});
      if (data.complete) data.complete({});
    },
    createRewardedVideoAd(config) {
      const listeners = { close: new Set(), error: new Set(), load: new Set() };
      const sdk = {
        config, showCalls: 0, loadCalls: 0, destroyCalls: 0, listeners,
        onClose(fn) { listeners.close.add(fn); }, offClose(fn) { listeners.close.delete(fn); },
        onError(fn) { listeners.error.add(fn); }, offError(fn) { listeners.error.delete(fn); },
        onLoad(fn) { listeners.load.add(fn); }, offLoad(fn) { listeners.load.delete(fn); },
        show() {
          sdk.showCalls += 1;
          return options.show ? options.show(sdk.showCalls, sdk) : Promise.resolve();
        },
        load() {
          sdk.loadCalls += 1;
          return options.load ? options.load(sdk.loadCalls, sdk) : Promise.resolve();
        },
        destroy() { sdk.destroyCalls += 1; },
        emitClose(value) { for (const fn of [...listeners.close]) fn(value); },
        emitError(value = { errCode: 1004, errMsg: 'no fill' }) { for (const fn of [...listeners.error]) fn(value); }
      };
      calls.ads.push(sdk);
      return sdk;
    }
  };
  if (options.unsupported) delete wx.createRewardedVideoAd;

  const modules = new Map();
  let pageDefinition;
  const context = vm.createContext({ wx, console, setTimeout, clearTimeout, Promise, Date, Page(value) { pageDefinition = value; } });
  function loadModule(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.resolve(root, relative);
    if (filename === path.resolve(root, 'miniprogram/services/api.js')) return api;
    if (filename === path.resolve(root, 'miniprogram/utils/auth.js')) return auth;
    if (filename === path.resolve(root, 'miniprogram/utils/share.js')) return { defaultShare: () => ({}) };
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const script = new vm.Script(`(function(require, module, exports) {\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename });
    script.runInContext(context)(request => {
      const target = path.resolve(path.dirname(filename), request);
      return loadModule(path.extname(target) ? target : `${target}.js`);
    }, module, module.exports);
    return module.exports;
  }

  function newPage() {
    loadModule('miniprogram/pages/resources/detail/index.js');
    const page = { ...pageDefinition, data: JSON.parse(JSON.stringify(pageDefinition.data)) };
    page.setData = value => Object.assign(page.data, value);
    return page;
  }

  async function openPage(id = resource.id) {
    const page = newPage();
    page.onLoad({ id });
    await until(() => !page.data.loading, 'resource detail');
    // Allow background ad config/login promises to settle without showing an ad.
    await new Promise(resolve => setImmediate(resolve));
    return page;
  }

  return { api, auth, wx, calls, resource, loadModule, newPage, openPage };
}

module.exports = { createHarness, deferred, until, adUnitId };
