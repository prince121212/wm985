// WeChat can reuse the SDK object for the same slot. Keep a single listener pair
// and give each page a disposable handle, so callbacks cannot reward another page.
const instances = Object.create(null);

function adError(message) {
  return new Error(message || '广告暂时不可用，请稍后重试');
}

function createSharedAd(adUnitId) {
  if (typeof wx.createRewardedVideoAd !== 'function') {
    throw adError('当前微信版本不支持激励广告，请升级微信');
  }
  const ad = wx.createRewardedVideoAd({ adUnitId });
  if (!ad || typeof ad.onClose !== 'function' || typeof ad.onError !== 'function') {
    throw adError();
  }
  const shared = { ad, handles: new Set(), pending: null, disposed: false };

  function dispose() {
    if (shared.disposed) return;
    shared.disposed = true;
    if (typeof ad.offClose === 'function') ad.offClose(onClose);
    if (typeof ad.offError === 'function') ad.offError(onError);
    if (typeof ad.destroy === 'function') ad.destroy();
    if (instances[adUnitId] === shared) delete instances[adUnitId];
  }

  function settle(error) {
    const pending = shared.pending;
    if (!pending) return;
    shared.pending = null;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve();
  }

  function fail(error) {
    settle(error);
    // A failed/timed-out playback can emit a delayed close. Retire this SDK
    // object so that delayed callback can never complete a new attempt.
    dispose();
  }

  const onClose = (result) => {
    if (shared.disposed) return;
    if (!shared.pending) return;
    if (result && result.isEnded === true) settle();
    else fail(adError('需完整观看广告后才能获取资源'));
  };
  const onError = () => {
    // SDK errors never count as a completed view, including a late close event.
    if (!shared.disposed) fail(adError());
  };
  ad.onClose(onClose);
  ad.onError(onError);

  shared.watch = (owner) => {
    if (shared.disposed) return Promise.reject(adError('广告已失效，请重试'));
    if (shared.pending) return Promise.reject(adError('广告正在播放，请稍候'));
    return new Promise((resolve, reject) => {
      const pending = { owner, resolve, reject, playing: false, timer: null };
      shared.pending = pending;
      pending.timer = setTimeout(() => fail(adError('广告加载超时，请稍后重试')), 20000);
      const isCurrent = () => shared.pending === pending;

      Promise.resolve().then(() => {
        if (!isCurrent()) return;
        return ad.show();
      }).catch(() => {
        if (!isCurrent()) return;
        return Promise.resolve().then(() => ad.load()).then(() => {
          if (isCurrent()) return ad.show();
        });
      }).then(() => {
        if (!isCurrent()) return;
        pending.playing = true;
        clearTimeout(pending.timer);
        // No reward if a platform callback is lost; releases the button lock.
        pending.timer = setTimeout(() => fail(adError('广告观看已超时，请重试')), 10 * 60 * 1000);
      }).catch(() => {
        if (isCurrent()) fail(adError());
      });
    });
  };

  shared.release = (owner) => {
    if (shared.pending && shared.pending.owner === owner) {
      fail(adError('资源页面已关闭'));
    }
    shared.handles.delete(owner);
    if (shared.handles.size) return;
    dispose();
  };
  return shared;
}

function createRewardedAd(adUnitId) {
  if (typeof adUnitId !== 'string' || !/^adunit-[a-zA-Z0-9]+$/.test(adUnitId)) {
    throw adError('广告尚未配置，请稍后重试');
  }
  const shared = instances[adUnitId] || (instances[adUnitId] = createSharedAd(adUnitId));
  let destroyed = false;
  const handle = {
    watch() {
      if (destroyed || shared.disposed) return Promise.reject(adError('广告已失效，请重试'));
      return shared.watch(handle);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shared.release(handle);
    },
    isDestroyed() { return destroyed || shared.disposed; }
  };
  shared.handles.add(handle);
  return handle;
}

module.exports = { createRewardedAd };
