import { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './ErrorBoundary.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 全局错误边界组件
 * 捕获子组件中的 JavaScript 错误，记录错误信息，并显示降级 UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state，下次渲染时显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    this.setState({ errorInfo });

    // 错误上报
    this.reportError(error, errorInfo);
  }

  /**
   * 上报错误信息
   * 可以接入 Sentry 或其他错误监控平台
   */
  private reportError(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // TODO: 接入 Sentry 或其他错误监控平台
    // if (typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, {
    //     extra: { componentStack: errorInfo.componentStack }
    //   });
    // }

    // 本地存储错误日志（用于调试）
    try {
      const errorLog = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        page: Taro.getCurrentInstance()?.router?.path || 'unknown',
      };

      // 获取现有日志
      const existingLogs = Taro.getStorageSync('error_logs') || [];

      // 保留最近 10 条错误日志
      const updatedLogs = [errorLog, ...existingLogs].slice(0, 10);

      Taro.setStorageSync('error_logs', updatedLogs);
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  }

  /**
   * 重置错误状态
   */
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * 返回首页
   */
  private handleGoHome = () => {
    this.handleReset();
    Taro.switchTab({ url: '/pages/index/index' });
  };

  /**
   * 刷新当前页面
   */
  private handleRefresh = () => {
    this.handleReset();
    // 获取当前页面路径
    const currentPage = Taro.getCurrentInstance()?.router;
    if (currentPage?.path) {
      // 重新加载当前页面
      Taro.redirectTo({
        url: currentPage.path + (currentPage.params ? '?' + new URLSearchParams(currentPage.params as Record<string, string>).toString() : ''),
      }).catch(() => {
        // 如果 redirectTo 失败（比如是 tabBar 页面），尝试 switchTab
        Taro.switchTab({ url: currentPage.path });
      });
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // 如果提供了自定义 fallback，使用它
      if (fallback) {
        return fallback;
      }

      // 默认的错误 UI
      return (
        <View className="error-boundary">
          <View className="error-boundary__icon">!</View>
          <Text className="error-boundary__title">页面出错了</Text>
          <Text className="error-boundary__message">
            {error?.message || '发生了未知错误'}
          </Text>
          <View className="error-boundary__actions">
            <Button
              className="error-boundary__button error-boundary__button--primary"
              onClick={this.handleRefresh}
            >
              刷新页面
            </Button>
            <Button
              className="error-boundary__button error-boundary__button--secondary"
              onClick={this.handleGoHome}
            >
              返回首页
            </Button>
          </View>
          {process.env.NODE_ENV === 'development' && error?.stack && (
            <View className="error-boundary__stack">
              <Text className="error-boundary__stack-title">错误堆栈：</Text>
              <Text className="error-boundary__stack-content">{error.stack}</Text>
            </View>
          )}
        </View>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
