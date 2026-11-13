App({
  onLaunch(options) {
    this.opsMode = options.path === 'pages/ops/index' && options.query && options.query.mode === 'mock-ops';
    this.resumeRoleOnLaunch = options.path === 'pages/home/index';
  },
  onShow(options) {
    if (options.path === 'pages/ops/index' && options.query && options.query.mode === 'mock-ops') {
      this.opsMode = true;
    }
  }
});
