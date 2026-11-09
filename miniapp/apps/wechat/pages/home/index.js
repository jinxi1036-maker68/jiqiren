const store = require('../../lib/storage');

Page({
  onLoad(options) {
    const role = store.read().selection;
    if (options.choose !== '1' && role) wx.redirectTo({ url: '/pages/' + role + '/index' });
  },
  choose(event) {
    const role = event.currentTarget.dataset.role;
    store.change(state => { state.selection = role; });
    wx.redirectTo({ url: '/pages/' + role + '/index' });
  },
  reset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清除此项目在本机的模拟订单、消息和操作记录。',
      confirmText: '重置',
      success(result) {
        if (result.confirm) {
          store.reset();
          wx.showToast({ title: '已重置' });
        }
      }
    });
  }
});
