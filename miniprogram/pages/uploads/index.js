const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');
const { formatDate, formatNumber, ratingText, stars, statusText, priceText, isPaid } = require('../../utils/format');

function decorateResource(item) {
  return Object.assign({}, item, {
    initial: (item.title || '资').slice(0, 1),
    category_name: item.category ? item.category.name : '未分类',
    status_text: statusText(item.status),
    created_text: formatDate(item.created_at, true),
    access_text: formatNumber(item.access_count || 0),
    view_text: formatNumber(item.view_count || 0),
    display_rating: ratingText(item.rating_avg),
    rating_stars: stars(item.rating_avg),
    price_text: priceText(item),
    is_paid: isPaid(item)
  });
}

Page({
  data: {
    resources: [],
    stats: {},
    status: '',
    search: '',
    sort: 'latest',
    loading: true
  },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    try {
      await auth.ensureLogin();
      const result = await api.myUploads({ status: this.data.status, search: this.data.search, sort: this.data.sort, limit: 100 });
      this.setData({ resources: (result.resources || []).map(decorateResource), stats: result.stats || {}, loading: false });
    } catch (error) {
      this.setData({ loading:false });
      wx.showToast({ title: error.message || '加载失败', icon:'none' });
    }
  },
  onSearchInput(e) { this.setData({ search: e.detail.value }); },
  submitSearch() { this.load(); },
  setStatus(e) { this.setData({ status: e.currentTarget.dataset.status || '' }); this.load(); },
  setSort(e) { this.setData({ sort: e.currentTarget.dataset.sort || 'latest' }); this.load(); },
  goDetail(e) { wx.navigateTo({ url: `/pages/resources/detail/index?id=${e.currentTarget.dataset.id}` }); },
  async deleteResource(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除资源',
      content: '确定要删除这个资源吗？此操作不可恢复。',
      confirmColor: '#d44b1c',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteResource(id);
          this.setData({ resources: this.data.resources.filter(item => item.uuid !== id) });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      }
    });
  },
  onShareAppMessage() { return defaultShare('/pages/upload/index', { scene: 'uploads' }, '来文明知识库分享你的优质资源'); }
});
