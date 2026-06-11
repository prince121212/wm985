const { request } = require('../utils/request');
const { API_BASE_URL } = require('../config');

function login(data) { return request({ url: '/api/mp/auth/login', method: 'POST', data, auth: false }); }
function me() { return request({ url: '/api/mp/user/me' }); }
function recordShare(data) { return request({ url: '/api/mp/share/record', method: 'POST', data }); }
function categories() { return request({ url: '/api/mp/categories?include_count=true' }); }
function tags(limit = 20) { return request({ url: `/api/mp/tags?type=popular&limit=${limit}` }); }
function resources(params = {}) {
  const query = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/resources${query ? `?${query}` : ''}`, auth: false });
}
function resourceDetail(id) { return request({ url: `/api/mp/resources/${id}`, auth: false }); }
function accessResource(id) { return request({ url: `/api/mp/resources/${id}/access`, method: 'POST' }); }
function resourceComments(id, params = {}) {
  const query = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/resources/${id}/comments${query ? `?${query}` : ''}`, auth: false });
}
function addResourceComment(id, data) { return request({ url: `/api/mp/resources/${id}/comments`, method: 'POST', data }); }
function resourceRating(id) { return request({ url: `/api/mp/resources/${id}/rating` }); }
function submitResourceRating(id, rating) { return request({ url: `/api/mp/resources/${id}/rating`, method: 'POST', data: { rating } }); }
function deleteResource(id) { return request({ url: `/api/mp/resources/${id}`, method: 'DELETE' }); }
function checkUrl(url) { return request({ url: '/api/check-url', method: 'POST', data: { url }, auth: false }); }
function createResource(data) { return request({ url: '/api/mp/resources', method: 'POST', data }); }
function updateProfile(data) { return request({ url: '/api/mp/user/profile', method: 'POST', data }); }
function uploadAvatar(filePath) {
  const token = wx.getStorageSync('mp_token');
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/mp/user/avatar`,
      filePath,
      name: 'avatar',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body = {};
        try { body = JSON.parse(res.data || '{}'); } catch (error) {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
        } else {
          reject(new Error(body.message || `上传失败 (${res.statusCode})`));
        }
      },
      fail(err) { reject(new Error(err.errMsg || '上传失败')); }
    });
  });
}
function submitFeedback(data) { return request({ url: '/api/mp/feedback', method: 'POST', data }); }
function favoriteStatus(id) { return request({ url: `/api/mp/resources/${id}/favorite` }); }
function toggleFavorite(id) { return request({ url: `/api/mp/resources/${id}/favorite`, method: 'POST' }); }
function myFavorites(params = {}) {
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/my/favorites${query ? `?${query}` : ''}` });
}
function myUploads(params = {}) {
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/my/uploads${query ? `?${query}` : ''}` });
}
function myCredits(params = {}) {
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/my/credits${query ? `?${query}` : ''}` });
}
function myInvites(params = {}) {
  const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return request({ url: `/api/mp/my/invites${query ? `?${query}` : ''}` });
}

module.exports = {
  login,
  me,
  recordShare,
  categories,
  tags,
  resources,
  resourceDetail,
  accessResource,
  resourceComments,
  addResourceComment,
  resourceRating,
  submitResourceRating,
  deleteResource,
  checkUrl,
  createResource,
  updateProfile,
  uploadAvatar,
  submitFeedback,
  favoriteStatus,
  toggleFavorite,
  myFavorites,
  myUploads,
  myCredits,
  myInvites
};
