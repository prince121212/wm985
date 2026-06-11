const api = require('../services/api');

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) { res.code ? resolve(res.code) : reject(new Error('未获取到微信登录 code')); },
      fail(err) { reject(new Error(err.errMsg || '微信登录失败')); }
    });
  });
}

async function login(launchQuery = {}) {
  const code = await wxLoginCode();
  const result = await api.login({ code });
  wx.setStorageSync('mp_token', result.token);
  wx.setStorageSync('mp_user', result.user);

  if (launchQuery.share_user && launchQuery.share_user !== result.user.uuid) {
    api.recordShare({
      share_user: launchQuery.share_user,
      scene: launchQuery.scene || 'launch',
      target_type: launchQuery.target_type || '',
      target_id: launchQuery.target_id || ''
    }).then((shareResult) => {
      if (shareResult.rewarded) {
        wx.showToast({ title: '获得20积分', icon: 'success' });
      }
    }).catch(() => {});
  }

  return result;
}

async function ensureLogin() {
  const token = wx.getStorageSync('mp_token');
  const user = wx.getStorageSync('mp_user');
  if (token && user) return { token, user };
  return login({});
}

module.exports = { login, ensureLogin };
