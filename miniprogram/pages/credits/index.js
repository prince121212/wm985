const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');
const { formatDate } = require('../../utils/format');

const TYPE_TEXT = {
  new_user: '新用户奖励',
  share_reward: '分享奖励',
  invitee_bonus: '被邀请奖励',
  system_add: '系统赠送',
  resource_reward: '资源奖励',
  resource_access: '访问资源',
  order_pay: '充值'
};

function decorateCredit(item) {
  const credits = Number(item.credits || 0);
  const resource = item.resource || null;
  return Object.assign({}, item, {
    type_text: TYPE_TEXT[item.trans_type] || item.trans_type,
    credits_text: credits > 0 ? `+${credits}` : `${credits}`,
    is_income: credits > 0,
    date_text: formatDate(item.created_at, true),
    resource_title: resource ? resource.title : '',
    trans_no_short: item.trans_no ? `${item.trans_no.slice(0, 8)}...${item.trans_no.slice(-4)}` : ''
  });
}

Page({
  data: { credits: [], balance: { left_credits: 0 }, loading: true },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    try {
      await auth.ensureLogin();
      const result = await api.myCredits({ page: 1, limit: 100 });
      this.setData({
        credits: (result.credits || []).map(decorateCredit),
        balance: result.balance || { left_credits: 0 },
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },
  onShareAppMessage() { return defaultShare('/pages/index/index', { scene: 'credits' }, '来文明知识库一起领积分'); }
});
