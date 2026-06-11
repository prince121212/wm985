Component({
  options: {
    addGlobalClass: true
  },

  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页' },
      { pagePath: '/pages/resources/list/index', text: '资源' },
      { pagePath: '/pages/upload/index', text: '上传' },
      { pagePath: '/pages/profile/index', text: '我的' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (!item || this.data.selected === index) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
