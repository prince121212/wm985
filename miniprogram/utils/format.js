function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDate(value, withTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, withTime ? 16 : 10);
  const text = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!withTime) return text;
  return `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatNumber(value) {
  const num = Number(value || 0);
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function ratingText(value) {
  return Number(value || 0).toFixed(1);
}

function stars(value) {
  const rating = Math.round(Number(value || 0));
  return [1, 2, 3, 4, 5].map(item => (item <= rating ? '★' : '☆')).join('');
}

function statusText(status) {
  const map = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  return map[status] || status || '未知';
}

function userTitle(uploadedCount) {
  const count = Number(uploadedCount || 0);
  if (count === 0) return '小萌新';
  if (count <= 5) return '初级贡献者';
  if (count <= 15) return '活跃贡献者';
  if (count <= 30) return '资深贡献者';
  if (count <= 50) return '专业分享者';
  if (count <= 100) return '知识达人';
  if (count <= 200) return '资源专家';
  if (count <= 500) return '传术师';
  return '传道者';
}

function priceText(resource) {
  if (!resource || resource.is_free !== false) return '免费';
  return `${Number(resource.credits || 0)}积分`;
}

function isPaid(resource) {
  return !!(resource && resource.is_free === false && Number(resource.credits || 0) > 0);
}

module.exports = { formatDate, formatNumber, ratingText, stars, statusText, userTitle, priceText, isPaid };
