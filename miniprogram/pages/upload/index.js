const api = require('../../services/api');
const auth = require('../../utils/auth');
const { defaultShare } = require('../../utils/share');

Page({
  data: {
    aiText: '',
    title: '',
    description: '',
    content: '',
    file_url: '',
    category_id: '',
    category_name: '',
    categories: [],
    tagInput: '',
    tags: [],
    urlChecked: false,
    urlAvailable: false,
    is_free: true,
    credits: 0,
    submitting: false
  },

  onLoad() { this.loadCategories(); },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  async loadCategories() {
    try {
      const result = await api.categories();
      this.setData({ categories: result.categories || [] });
    } catch (error) {}
  },

  setField(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },

  setAccessType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ is_free: type !== 'credits', credits: type === 'credits' ? (this.data.credits || 1) : 0 });
  },

  smartFill() {
    const text = this.data.aiText.trim();
    if (!text) { wx.showToast({ title: '请先粘贴资源文案', icon: 'none' }); return; }
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    const firstLine = text.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    const tags = Array.from(new Set((text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) || []).slice(0, 5)));
    this.setData({
      title: this.data.title || firstLine.slice(0, 50),
      description: this.data.description || text.replace(urlMatch ? urlMatch[0] : '', '').trim().slice(0, 180),
      file_url: this.data.file_url || (urlMatch ? urlMatch[0] : ''),
      tags: this.data.tags.length ? this.data.tags : tags,
      urlChecked: false,
      urlAvailable: false
    });
    wx.showToast({ title: '已智能填充', icon: 'success' });
  },

  async checkUrl() {
    const url = this.data.file_url.trim();
    if (!url) { wx.showToast({ title: '请输入资源链接', icon: 'none' }); return; }
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const result = await api.checkUrl(normalizedUrl);
      this.setData({ file_url: normalizedUrl, urlChecked: true, urlAvailable: !!result.available });
      wx.showToast({ title: result.available ? '链接可用' : '链接不可用', icon: result.available ? 'success' : 'none' });
    } catch (error) {
      this.setData({ urlChecked: true, urlAvailable: false });
      wx.showToast({ title: error.message || '检查失败', icon: 'none' });
    }
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value);
    const category = this.data.categories[index];
    this.setData({ category_id: category ? category.id : '', category_name: category ? category.name : '' });
  },

  addTag() {
    const tag = this.data.tagInput.trim();
    if (!tag) return;
    if (this.data.tags.includes(tag)) { wx.showToast({ title: '标签已存在', icon: 'none' }); return; }
    if (this.data.tags.length >= 10) { wx.showToast({ title: '最多10个标签', icon: 'none' }); return; }
    this.setData({ tags: this.data.tags.concat(tag), tagInput: '' });
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ tags: this.data.tags.filter(item => item !== tag) });
  },

  async submit() {
    if (!this.data.title.trim()) return wx.showToast({ title: '请输入标题', icon: 'none' });
    if (!this.data.description.trim()) return wx.showToast({ title: '请输入描述', icon: 'none' });
    if (!this.data.file_url.trim()) return wx.showToast({ title: '请输入链接', icon: 'none' });
    if (!this.data.category_id) return wx.showToast({ title: '请选择分类', icon: 'none' });
    if (!this.data.urlChecked || !this.data.urlAvailable) return wx.showToast({ title: '请先检查链接', icon: 'none' });
    if (!this.data.is_free && Number(this.data.credits || 0) <= 0) return wx.showToast({ title: '请设置积分数量', icon: 'none' });

    try {
      this.setData({ submitting: true });
      await auth.ensureLogin();
      await api.createResource({
        title: this.data.title,
        description: this.data.description,
        content: this.data.content,
        file_url: this.data.file_url,
        category_id: this.data.category_id,
        tags: this.data.tags,
        is_free: this.data.is_free,
        credits: Number(this.data.credits || 0)
      });
      wx.showToast({ title: '已提交审核', icon: 'success' });
      this.setData({ title: '', description: '', content: '', file_url: '', category_id: '', category_name: '', tags: [], tagInput: '', aiText: '', urlChecked: false, urlAvailable: false, is_free: true, credits: 0 });
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onShareAppMessage() {
    return defaultShare('/pages/upload/index', { scene: 'upload' }, '来文明知识库分享你的优质资源');
  }
});
