const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');
const { formatDate, formatNumber, ratingText, stars } = require('../../utils/format');

function decorateFavorite(item) {
  const resource = item.resource || {};
  return Object.assign({}, item, {
    created_text: formatDate(item.created_at, true),
    resource: Object.assign({}, resource, {
      initial: (resource.title || '资').slice(0, 1),
      category_name: resource.category ? resource.category.name : '未分类',
      author_name: resource.author ? (resource.author.nickname || '匿名用户') : '匿名用户',
      author_avatar: resource.author ? (resource.author.avatar_url || '') : '',
      display_rating: ratingText(resource.rating_avg),
      rating_stars: stars(resource.rating_avg),
      access_text: formatNumber(resource.access_count || 0),
      view_text: formatNumber(resource.view_count || 0),
      publish_text: formatDate(resource.created_at)
    })
  });
}

function filterAndSort(favorites, search, sort) {
  let list = favorites.slice();
  const keyword = (search || '').trim().toLowerCase();
  if (keyword) {
    list = list.filter(item => {
      const resource = item.resource || {};
      return (resource.title || '').toLowerCase().includes(keyword) ||
        (resource.description || '').toLowerCase().includes(keyword);
    });
  }

  list.sort((a, b) => {
    const ar = a.resource || {};
    const br = b.resource || {};
    if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sort === 'popular') return (br.access_count || 0) - (ar.access_count || 0);
    if (sort === 'rating') return (br.rating_avg || 0) - (ar.rating_avg || 0);
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return list;
}

Page({
  data: {
    favorites: [],
    filteredFavorites: [],
    search: '',
    sort: 'latest',
    loading: true
  },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    try {
      await auth.ensureLogin();
      const result = await api.myFavorites({ limit: 100 });
      const favorites = (result.favorites || []).map(decorateFavorite);
      this.setData({
        favorites,
        filteredFavorites: filterAndSort(favorites, this.data.search, this.data.sort),
        loading: false
      });
    } catch (error) {
      this.setData({ loading:false });
      wx.showToast({ title: error.message || '加载失败', icon:'none' });
    }
  },
  refreshFilter() {
    this.setData({ filteredFavorites: filterAndSort(this.data.favorites, this.data.search, this.data.sort) });
  },
  onSearchInput(e) { this.setData({ search: e.detail.value }); this.refreshFilter(); },
  selectSort(e) { this.setData({ sort: e.currentTarget.dataset.sort || 'latest' }); this.refreshFilter(); },
  goDetail(e) { wx.navigateTo({ url: `/pages/resources/detail/index?id=${e.currentTarget.dataset.id}` }); },
  async removeFavorite(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api.toggleFavorite(id);
      const favorites = this.data.favorites.filter(item => item.resource && item.resource.uuid !== id);
      this.setData({ favorites, filteredFavorites: filterAndSort(favorites, this.data.search, this.data.sort) });
      wx.showToast({ title: '已取消收藏', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '取消失败', icon: 'none' });
    }
  },
  onShareAppMessage() { return defaultShare('/pages/index/index', { scene: 'favorites' }, '来文明知识库发现免费资源'); }
});
