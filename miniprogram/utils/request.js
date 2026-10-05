const { API_BASE_URL } = require('../config');

function request(options) {
  const token = wx.getStorageSync('mp_token');
  const header = Object.assign({
    'content-type': 'application/json'
  }, options.header || {}, {
    // The new protocol never falls back to legacy access after a failed request.
    'X-MP-Resource-Access-Version': '1'
  });

  if (token && options.auth !== false) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
        } else {
          const message = body.message || `请求失败 (${res.statusCode})`;
          const error = new Error(message);
          error.statusCode = res.statusCode;
          error.code = body.code;
          reject(error);
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

module.exports = { request };
