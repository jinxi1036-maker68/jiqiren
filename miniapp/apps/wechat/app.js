App({
  onLaunch(options) {
    this.opsMode = options.path === 'pages/ops/index' && options.query && options.query.mode === 'mock-ops';
  },
  onShow(options) {
    if (options.path === 'pages/ops/index' && options.query && options.query.mode === 'mock-ops') {
      this.opsMode = true;
    }
  }
});
