const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');

Page({
  data: { content: '', rating: 10, submitting: false },
  onInput(e) { this.setData({ content: e.detail.value }); },
  onRatingChange(e) { this.setData({ rating: Number(e.detail.value) || 10 }); },
  async submit() {
    const content = this.data.content.trim();
    if (!content) return wx.showToast({ title: '请输入反馈内容', icon: 'none' });
    try {
      this.setData({ submitting: true });
      await auth.ensureLogin();
      const result = await api.submitFeedback({ content, rating: this.data.rating });
      wx.showToast({ title: result.message || '已提交', icon: 'success' });
      this.setData({ content: '', rating: 10, submitting: false });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    }
  },
  onShareAppMessage() { return defaultShare('/pages/index/index', { scene: 'feedback' }, '来文明知识库发现免费资源'); }
});
