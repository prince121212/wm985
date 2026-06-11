const api = require('../../services/api');
const { defaultShare } = require('../../utils/share');
const { formatNumber, ratingText, stars, priceText, isPaid } = require('../../utils/format');

function decorateResource(item) {
  return Object.assign({}, item, {
    initial: (item.title || '资').slice(0, 1),
    category_name: item.category ? item.category.name : '未分类',
    author_name: item.author ? (item.author.nickname || '匿名用户') : '匿名用户',
    display_rating: ratingText(item.rating_avg),
    rating_stars: stars(item.rating_avg),
    access_text: formatNumber(item.access_count || 0),
    price_text: priceText(item),
    is_paid: isPaid(item)
  });
}
function decorateCategory(item) { return Object.assign({}, item, { initial: (item.name || '分').slice(0, 1) }); }

Page({
  data: {
    categories: [],
    tags: [],
    popular: [],
    latest: [],
    loading: true
  },

  onLoad() { this.loadData(); },

  async loadData() {
    try {
      const [categoryResult, tagResult, popularResult, latestResult] = await Promise.all([
        api.categories(),
        api.tags(12),
        api.resources({ sort: 'popular', limit: 4 }),
        api.resources({ sort: 'latest', limit: 4 })
      ]);
      this.setData({
        categories: (categoryResult.categories || []).slice(0, 6).map(decorateCategory),
        tags: tagResult.tags || [],
        popular: (popularResult.resources || []).map(decorateResource),
        latest: (latestResult.resources || []).map(decorateResource),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },

  goSearch() { wx.switchTab({ url: '/pages/resources/list/index' }); },
  goCategory(e) { wx.setStorageSync('resource_filter', { category: e.currentTarget.dataset.id }); wx.switchTab({ url: '/pages/resources/list/index' }); },
  goTag(e) { wx.setStorageSync('resource_filter', { tags: e.currentTarget.dataset.name }); wx.switchTab({ url: '/pages/resources/list/index' }); },
  goDetail(e) { wx.navigateTo({ url: `/pages/resources/detail/index?id=${e.currentTarget.dataset.id}` }); },

  onShareAppMessage() {
    return defaultShare('/pages/index/index', { scene: 'home' }, '文明知识库：发现优质资源');
  }
});
