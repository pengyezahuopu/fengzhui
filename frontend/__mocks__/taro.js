const taro = {
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  navigateBack: jest.fn(),
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  getCurrentInstance: jest.fn(() => ({
    router: {
      params: {},
    },
  })),
  useRouter: jest.fn(() => ({
    params: {},
  })),
  Events: class {
    on() {}
    off() {}
    trigger() {}
  },
  pxTransform: (size) => `${size}px`,
  createSelectorQuery: () => ({
      select: () => ({
          boundingClientRect: () => ({
              exec: (cb) => cb && cb([{ top: 0, height: 100 }]),
          }),
      }),
  }),
  getSystemInfoSync: () => ({
    windowWidth: 375,
    windowHeight: 667,
    safeArea: {
      top: 44,
      bottom: 34,
    },
  }),
  getEnv: () => 'WEB',
};

export default taro;
