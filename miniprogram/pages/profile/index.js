const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');

Page({
  data: { user: null, credits: { left_credits: 0 }, stats: { favorites: 0, uploads: 0, pending: 0 }, nicknameInput: '', savingProfile: false, uploadingAvatar: false, loading: true },
  onShow() { this.loadMe(); },
  async loadMe() {
    try {
      await auth.ensureLogin();
      const result = await api.me();
      this.setData({ user: result.user, nicknameInput: (result.user && result.user.nickname) || '', credits: result.credits || {}, stats: result.stats || {}, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    }
  },
  onNicknameInput(e) { this.setData({ nicknameInput: e.detail.value }); },
  chooseAvatar() {
    const handlePath = async (filePath) => {
      if (!filePath) return;
      try {
        this.setData({ uploadingAvatar: true });
        await auth.ensureLogin();
        const result = await api.uploadAvatar(filePath);
        wx.setStorageSync('mp_user', result.user);
        this.setData({ user: result.user, uploadingAvatar: false });
        wx.showToast({ title: '头像已更新', icon: 'success' });
      } catch (error) {
        this.setData({ uploadingAvatar: false });
        wx.showToast({ title: error.message || '上传失败', icon: 'none' });
      }
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => handlePath(res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath),
        fail: (err) => { if (err.errMsg && !err.errMsg.includes('cancel')) wx.showToast({ title: '选择图片失败', icon: 'none' }); }
      });
    } else {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: (res) => handlePath(res.tempFilePaths && res.tempFilePaths[0]),
        fail: (err) => { if (err.errMsg && !err.errMsg.includes('cancel')) wx.showToast({ title: '选择图片失败', icon: 'none' }); }
      });
    }
  },
  async saveProfile() {
    const nickname = this.data.nicknameInput.trim();
    if (!nickname) return wx.showToast({ title: '昵称不能为空', icon: 'none' });
    try {
      this.setData({ savingProfile: true });
      const result = await api.updateProfile({ nickname });
      wx.setStorageSync('mp_user', result.user);
      this.setData({ user: result.user, nicknameInput: result.user.nickname || nickname, savingProfile: false });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      this.setData({ savingProfile: false });
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    }
  },
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/index' }); },
  goUploads() { wx.navigateTo({ url: '/pages/uploads/index' }); },
  goCredits() { wx.navigateTo({ url: '/pages/credits/index' }); },
  goInvites() { wx.navigateTo({ url: '/pages/invites/index' }); },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/index' }); },
  onShareAppMessage() { return defaultShare('/pages/index/index', { scene: 'profile' }, '我在文明知识库发现了很多优质资源'); }
});
