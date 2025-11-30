export default {
  pages: [
    'pages/index/index',
    'pages/activities/index',
    'pages/community/index',
    'pages/profile/index',
    'pages/activity/detail',
    'pages/route/detail',
    'pages/post/publish',
    'pages/post/detail',
    'pages/circle/index',
    'pages/circle/detail',
    'pages/album/index',
    'pages/user/profile',
    'pages/leaderboard/index',
    'pages/notification/index',
    // Phase 4: 订单与支付
    'pages/order/confirm',
    'pages/order/result',
    'pages/order/list',
    'pages/order/detail',
    'pages/order/qrcode',
    // Phase 4.2: 退款与核销
    'pages/refund/apply',
    'pages/verification/scan',
    'pages/verification/list',
    // Phase 4.3: 俱乐部管理与财务
    'pages/club/dashboard/index',
    'pages/club/finance/index',
    'pages/club/withdrawal/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '风追户外',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#667eea',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png'
      },
      {
        pagePath: 'pages/activities/index',
        text: '活动',
        iconPath: 'assets/icons/activity.png',
        selectedIconPath: 'assets/icons/activity-active.png'
      },
      {
        pagePath: 'pages/community/index',
        text: '社区',
        iconPath: 'assets/icons/community.png',
        selectedIconPath: 'assets/icons/community-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png'
      }
    ]
  }
}
