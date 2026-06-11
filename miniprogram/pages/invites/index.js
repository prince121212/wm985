const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');

function decorateReward(item) {
  const invitee = item.invitee || {};
  return Object.assign({}, item, {
    invitee_name: invitee.nickname || '微信好友',
    invitee_avatar: invitee.avatar_url || '',
    date_text: item.rewarded_at ? item.rewarded_at.slice(0, 10) : (item.created_at ? item.created_at.slice(0, 10) : '')
  });
}

Page({
  data: { rewards: [], total: 0, reward_credits: 20, total_reward_credits: 0, loading: true },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    try {
      await auth.ensureLogin();
      const result = await api.myInvites({ offset: 0, limit: 80 });
      this.setData({
        rewards: (result.rewards || []).map(decorateReward),
        total: result.total || 0,
        reward_credits: result.reward_credits || 20,
        total_reward_credits: (result.total || 0) * (result.reward_credits || 20),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },
  onShareAppMessage() { return defaultShare('/pages/index/index', { scene: 'invites' }, '来文明知识库，一起领20积分'); }
});
