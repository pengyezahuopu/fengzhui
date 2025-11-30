module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '@tarojs/taro': '<rootDir>/__mocks__/taro.js',
    '@tarojs/components': '<rootDir>/__mocks__/@tarojs/components.js',
    '@nutui/nutui-react-taro': '<rootDir>/__mocks__/@nutui/nutui-react-taro.js',
    '@/(.*)': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!@tarojs|@nutui)',
  ],
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
};
