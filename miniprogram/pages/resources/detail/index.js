const api = require('../../../services/api');
const auth = require('../../../utils/auth');
const { defaultShare } = require('../../../utils/share');
const { formatDate, formatNumber, ratingText, stars, userTitle } = require('../../../utils/format');

const RATING_STARS = [1, 2, 3, 4, 5];

function decorateResource(resource, authorStats) {
  const stats = authorStats || {};
  return Object.assign({}, resource, {
    category_name: resource && resource.category ? resource.category.name : '资源',
    author_name: resource && resource.author ? (resource.author.nickname || '贡献者') : '贡献者',
    author_avatar: resource && resource.author ? (resource.author.avatar_url || '') : '',
    display_rating: ratingText(resource && resource.rating_avg),
    rating_stars: stars(resource && resource.rating_avg),
    tags: resource && Array.isArray(resource.tags) ? resource.tags : [],
    created_text: formatDate(resource && resource.created_at, true),
    access_text: formatNumber(resource && resource.access_count),
    view_text: formatNumber(resource && resource.view_count),
    author_title: userTitle(stats.uploadedResourcesCount || 0)
  });
}

function decorateComment(comment) {
  const author = comment.author || {};
  return Object.assign({}, comment, {
    author_name: author.nickname || '微信用户',
    author_avatar: author.avatar_url || '',
    date_text: formatDate(comment.created_at, true),
    replies: (comment.replies || []).map(decorateComment)
  });
}

Page({
  data: {
    id: '',
    resource: null,
    authorStats: { uploadedResourcesCount: 0, totalVisitors: 0 },
    favorited: false,
    loading: true,
    comments: [],
    commentsTotal: 0,
    commentsLoading: false,
    ratingStars: RATING_STARS,
    userRating: 0,
    hasRated: false,
    commentContent: '',
    submittingReview: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.loadDetail();
  },

  async loadDetail() {
    if (!this.data.id) return;
    try {
      const result = await api.resourceDetail(this.data.id);
      const authorStats = result.author_stats || { uploadedResourcesCount: 0, totalVisitors: 0 };
      this.setData({
        resource: decorateResource(result.resource, authorStats),
        authorStats,
        loading: false
      });
      this.loadFavoriteStatus();
      this.loadUserRating();
      this.loadComments();
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '资源不存在', icon: 'none' });
    }
  },

  async loadFavoriteStatus() {
    try {
      await auth.ensureLogin();
      const result = await api.favoriteStatus(this.data.id);
      this.setData({ favorited: !!result.favorited });
    } catch (error) {}
  },

  async loadUserRating() {
    try {
      await auth.ensureLogin();
      const result = await api.resourceRating(this.data.id);
      this.setData({ userRating: result.rating || 0, hasRated: !!result.has_rated });
    } catch (error) {}
  },

  async loadComments() {
    if (!this.data.id || this.data.commentsLoading) return;
    this.setData({ commentsLoading: true });
    try {
      const result = await api.resourceComments(this.data.id, { offset: 0, limit: 50 });
      this.setData({
        comments: (result.comments || []).map(decorateComment),
        commentsTotal: result.total || 0,
        commentsLoading: false
      });
    } catch (error) {
      this.setData({ commentsLoading: false });
    }
  },

  goBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/resources/list/index' }) }); },

  async toggleFavorite() {
    try {
      await auth.ensureLogin();
      const result = await api.toggleFavorite(this.data.id);
      this.setData({ favorited: result.favorited });
      wx.showToast({ title: result.message || '操作成功', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
  },

  setRating(e) {
    this.setData({ userRating: Number(e.currentTarget.dataset.rating || 0) });
  },

  onCommentInput(e) {
    this.setData({ commentContent: e.detail.value });
  },

  async submitReview() {
    if (!this.data.userRating) return wx.showToast({ title: '请先选择评分', icon: 'none' });
    if (!this.data.commentContent.trim()) return wx.showToast({ title: '请输入评价内容', icon: 'none' });

    try {
      this.setData({ submittingReview: true });
      await auth.ensureLogin();
      const ratingResult = await api.submitResourceRating(this.data.id, this.data.userRating);
      const commentResult = await api.addResourceComment(this.data.id, { content: this.data.commentContent.trim() });
      const resource = Object.assign({}, this.data.resource, {
        rating_avg: ratingResult.rating_avg,
        rating_count: ratingResult.rating_count,
        display_rating: ratingText(ratingResult.rating_avg),
        rating_stars: stars(ratingResult.rating_avg)
      });
      this.setData({
        resource,
        hasRated: true,
        commentContent: '',
        comments: [decorateComment(commentResult.comment)].concat(this.data.comments),
        commentsTotal: this.data.commentsTotal + 1,
        submittingReview: false
      });
      wx.showToast({ title: '评价发布成功', icon: 'success' });
    } catch (error) {
      this.setData({ submittingReview: false });
      wx.showToast({ title: error.message || '发布失败', icon: 'none' });
    }
  },

  async copyResourceLink() {
    let url = this.data.resource && this.data.resource.file_url;
    if (!url) {
      wx.showToast({ title: '资源链接为空', icon: 'none' });
      return;
    }

    try {
      const result = await api.accessResource(this.data.id);
      if (result && result.resource_url) url = result.resource_url;
    } catch (error) {
      // 访问记录失败不影响复制链接
    }

    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    const resource = this.data.resource || {};
    return defaultShare(
      '/pages/resources/detail/index',
      { id: this.data.id, scene: 'resource', target_type: 'resource', target_id: this.data.id },
      resource.title ? `分享资源：${resource.title}` : '文明知识库资源分享'
    );
  }
});
