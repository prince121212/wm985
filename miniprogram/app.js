const auth = require('./utils/auth');

App({
  globalData: {
    launchQuery: {},
    user: null
  },

  onLaunch(options) {
    this.globalData.launchQuery = options.query || {};
    auth.login(options.query || {})
      .then(({ user }) => {
        this.globalData.user = user;
      })
      .catch((error) => {
        console.warn('小程序登录失败', error);
      });
  }
});
