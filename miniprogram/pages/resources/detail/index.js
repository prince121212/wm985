const api = require('../../../services/api');
const auth = require('../../../utils/auth');
const { createRewardedAd } = require('../../../utils/rewarded-ad');
const { defaultShare } = require('../../../utils/share');
const { formatDate, formatNumber, ratingText, stars, userTitle, priceText, isPaid } = require('../../../utils/format');

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
    author_title: userTitle(stats.uploadedResourcesCount || 0),
    price_text: priceText(resource),
    is_paid: isPaid(resource)
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
    submittingReview: false,
    accessing: false,
    accessLabel: '',
    copyReady: false
  },

  onLoad(options) {
    this._unloaded = false;
    this._accessAttempt = 0;
    this._accessBusy = false;
    this._pendingCopy = null;
    this._completedAdAccess = null;
    this.setData({ id: options.id || '' });
    this.loadDetail();
    // Prepare the SDK after remote configuration; showing always requires a tap.
    this.prepareRewardedAd().catch(() => {});
  },

  onUnload() {
    this._unloaded = true;
    this._accessAttempt += 1;
    this._pendingCopy = null;
    this._completedAdAccess = null;
    if (this._rewardedAd) this._rewardedAd.destroy();
    this._rewardedAd = null;
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

  async prepareRewardedAd() {
    if (this._unloaded) throw new Error('资源页面已关闭');
    if (this._rewardedAd && !this._rewardedAd.isDestroyed()) return this._adConfig;
    if (this._adConfigPromise) return this._adConfigPromise;
    this._adConfigPromise = api.adConfig().then((config) => {
      if (this._unloaded) throw new Error('资源页面已关闭');
      if (!config || config.enabled !== true || !config.ad_unit_id) {
        throw new Error('广告暂未开放，请稍后再试');
      }
      this._rewardedAd = createRewardedAd(config.ad_unit_id);
      this._adConfig = config;
      return config;
    });
    try {
      return await this._adConfigPromise;
    } finally {
      this._adConfigPromise = null;
    }
  },

  isCurrentAccess(id, attempt) {
    return !this._unloaded && this.data.id === id && this._accessAttempt === attempt;
  },

  confirmPaidAccess(resource) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '确认访问',
        content: `本资源需要${resource.credits || 0}积分，确认后将复制资源链接。`,
        confirmText: '确认访问',
        confirmColor: '#e9672e',
        success: (result) => resolve(!!result.confirm),
        fail: () => resolve(false)
      });
    });
  },

  async copyResourceLink() {
    if (this._unloaded || this._accessBusy || !this.data.resource || !this.data.id) return;
    const id = this.data.id;
    const resource = this.data.resource;
    const paid = isPaid(resource);
    const attempt = (this._accessAttempt || 0) + 1;
    this._accessAttempt = attempt;
    this._accessBusy = true;
    this.setData({ accessing: true, accessLabel: '准备中…' });
    const isCurrent = () => this.isCurrentAccess(id, attempt);

    try {
      // Only a successful access response can be retried at the clipboard step.
      let completed = this._pendingCopy;
      if (!completed || completed.resourceId !== id) {
        this._pendingCopy = null;
        this.setData({ copyReady: false });
        if (paid && !await this.confirmPaidAccess(resource)) return;
        if (!isCurrent()) return;
        await auth.ensureLogin();
        if (!isCurrent()) return;

        let accessData = {};
        if (!paid) {
          let ticket = this._completedAdAccess;
          if (!ticket || ticket.resourceId !== id || ticket.expiresAt <= Date.now()) {
            this._completedAdAccess = null;
            const config = await this.prepareRewardedAd();
            if (!isCurrent()) return;
            this.setData({ accessLabel: '加载广告…' });
            const session = await api.createResourceAdSession(id);
            if (!isCurrent()) return;
            const expiresAt = session && Date.parse(session.expires_at);
            if (!session || !session.session_id || session.ad_unit_id !== config.ad_unit_id ||
                !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
              // A remotely changed slot must be fetched again on the next tap.
              if (this._rewardedAd) this._rewardedAd.destroy();
              this._rewardedAd = null;
              throw new Error('广告配置已更新，请重试');
            }
            this.setData({ accessLabel: '观看完成后领取' });
            await this._rewardedAd.watch();
            if (!isCurrent()) return;
            if (expiresAt <= Date.now()) throw new Error('本次广告凭证已过期，请重新获取');
            ticket = { resourceId: id, sessionId: session.session_id, expiresAt };
            this._completedAdAccess = ticket;
          }
          accessData = { ad_session_id: ticket.sessionId, ad_completed: true };
        }

        if (!isCurrent()) return;
        this.setData({ accessLabel: '获取资源…' });
        const result = await api.accessResource(id, accessData);
        if (!isCurrent()) return;
        if (!result || typeof result.resource_url !== 'string' || !result.resource_url.trim()) {
          throw new Error('暂未获取到资源链接，请重试');
        }
        completed = { resourceId: id, url: result.resource_url, paid };
        this._pendingCopy = completed;
        this._completedAdAccess = null;
        this.setData({ copyReady: true });
      }

      if (!isCurrent()) return;
      this.setData({ accessLabel: '复制链接…' });
      await new Promise((resolve, reject) => {
        wx.setClipboardData({
          data: completed.url,
          success: resolve,
          fail: () => reject(new Error('复制失败，请点击“重新复制链接”，无需重复领取'))
        });
      });
      if (!isCurrent()) return;
      this._pendingCopy = null;
      this.setData({ copyReady: false });
      wx.showToast({ title: completed.paid ? '已扣积分并复制链接' : '链接已复制', icon: 'success' });
    } catch (error) {
      if (isCurrent()) {
        if (!paid && [400, 403, 404].indexOf(error.statusCode) !== -1) {
          // The server explicitly rejected this ticket/configuration. Only a
          // transport/server failure should retry an already-completed ticket.
          this._completedAdAccess = null;
          if (this._rewardedAd) this._rewardedAd.destroy();
          this._rewardedAd = null;
          if (error.statusCode === 400) this.loadDetail();
        }
        wx.showToast({ title: error.message || '获取失败，请稍后重试', icon: 'none' });
      }
    } finally {
      if (!this._unloaded && this._accessAttempt === attempt) {
        this._accessBusy = false;
        this.setData({ accessing: false, accessLabel: '' });
      }
    }
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
