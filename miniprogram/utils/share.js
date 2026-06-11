function buildSharePath(pagePath, params = {}) {
  const user = wx.getStorageSync('mp_user') || {};
  const merged = Object.assign({}, params);
  if (user.uuid) merged.share_user = user.uuid;
  const query = Object.keys(merged)
    .filter(key => merged[key] !== undefined && merged[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(merged[key])}`)
    .join('&');
  return `${pagePath}${query ? `?${query}` : ''}`;
}

function defaultShare(pagePath, params = {}, title = '文明知识库：发现优质资源') {
  return {
    title,
    path: buildSharePath(pagePath, params)
  };
}

module.exports = { buildSharePath, defaultShare };
