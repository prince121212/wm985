const api = require('../../../services/api');
const { defaultShare } = require('../../../utils/share');
const { formatDate, formatNumber, ratingText, stars } = require('../../../utils/format');

function decorateResource(item) {
  return Object.assign({}, item, {
    initial: (item.title || '资').slice(0, 1),
    category_name: item.category ? item.category.name : '未分类',
    author_name: item.author ? (item.author.nickname || '匿名用户') : '匿名用户',
    author_avatar: item.author ? (item.author.avatar_url || '') : '',
    display_rating: ratingText(item.rating_avg),
    rating_stars: stars(item.rating_avg),
    access_text: formatNumber(item.access_count || 0),
    view_text: formatNumber(item.view_count || 0),
    created_text: formatDate(item.created_at)
  });
}

Page({
  data: {
    search: '',
    category: '',
    tags: '',
    sort: 'latest',
    categories: [],
    tagList: [],
    resources: [],
    offset: 0,
    limit: 20,
    total: 0,
    loading: false,
    hasMore: true
  },

  onLoad(options) {
    if (options.category || options.tags || options.search) {
      this.setData({ category: options.category || '', tags: options.tags || '', search: options.search || '' });
    }
    this.loadMeta();
  },

  onShow() {
    const filter = wx.getStorageSync('resource_filter');
    if (filter) {
      wx.removeStorageSync('resource_filter');
      this.setData({ category: filter.category || '', tags: filter.tags || '', search: filter.search || '', offset: 0, resources: [] });
      this.loadResources(true);
    } else if (this.data.resources.length === 0) {
      this.loadResources(true);
    }
  },

  onPullDownRefresh() { this.loadResources(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.loadResources(false); },

  async loadMeta() {
    try {
      const [categoryResult, tagResult] = await Promise.all([api.categories(), api.tags(20)]);
      this.setData({ categories: categoryResult.categories || [], tagList: tagResult.tags || [] });
    } catch (error) {}
  },

  async loadResources(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    const offset = reset ? 0 : this.data.offset;
    try {
      const result = await api.resources({
        search: this.data.search,
        category: this.data.category,
        tags: this.data.tags,
        sort: this.data.sort,
        offset,
        limit: this.data.limit
      });
      const list = (result.resources || []).map(decorateResource);
      this.setData({
        resources: reset ? list : this.data.resources.concat(list),
        total: result.total || 0,
        offset: offset + list.length,
        hasMore: offset + list.length < (result.total || 0),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },

  onSearchInput(e) { this.setData({ search: e.detail.value }); },
  submitSearch() { this.loadResources(true); },
  selectCategory(e) { this.setData({ category: e.currentTarget.dataset.id || '' }); this.loadResources(true); },
  selectTag(e) { this.setData({ tags: e.currentTarget.dataset.name || '' }); this.loadResources(true); },
  selectSort(e) { this.setData({ sort: e.currentTarget.dataset.sort }); this.loadResources(true); },
  clearFilters() { this.setData({ search: '', category: '', tags: '', sort: 'latest' }); this.loadResources(true); },
  goDetail(e) { wx.navigateTo({ url: `/pages/resources/detail/index?id=${e.currentTarget.dataset.id}` }); },

  onShareAppMessage() {
    return defaultShare('/pages/resources/list/index', { scene: 'resources' }, '文明知识库资源库：免费资源合集');
  }
});
