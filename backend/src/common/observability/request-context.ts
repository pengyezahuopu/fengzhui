import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * 请求上下文数据结构
 */
export interface RequestContext {
  /** 唯一请求ID，用于链路追踪 */
  requestId: string;
  /** 用户ID（如果已认证） */
  userId?: string;
  /** 请求路径 */
  path?: string;
  /** 请求方法 */
  method?: string;
  /** 请求开始时间 */
  startTime: number;
  /** 额外的上下文数据 */
  extra?: Record<string, any>;
}

/**
 * 基于 AsyncLocalStorage 的请求上下文存储
 * 在整个请求生命周期中可访问，无需手动传递
 */
class RequestContextStorage {
  private storage = new AsyncLocalStorage<RequestContext>();

  /**
   * 在上下文中运行函数
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * 获取当前请求上下文
   */
  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * 获取当前请求ID
   */
  getRequestId(): string {
    return this.getContext()?.requestId || 'no-request-id';
  }

  /**
   * 获取当前用户ID
   */
  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  /**
   * 设置用户ID（在认证后调用）
   */
  setUserId(userId: string): void {
    const context = this.getContext();
    if (context) {
      context.userId = userId;
    }
  }

  /**
   * 添加额外的上下文数据
   */
  setExtra(key: string, value: any): void {
    const context = this.getContext();
    if (context) {
      context.extra = context.extra || {};
      context.extra[key] = value;
    }
  }

  /**
   * 获取请求耗时（毫秒）
   */
  getElapsedTime(): number {
    const context = this.getContext();
    if (!context) return 0;
    return Date.now() - context.startTime;
  }

  /**
   * 创建新的请求上下文
   */
  createContext(options: {
    requestId?: string;
    path?: string;
    method?: string;
    userId?: string;
  } = {}): RequestContext {
    return {
      requestId: options.requestId || `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      path: options.path,
      method: options.method,
      userId: options.userId,
      startTime: Date.now(),
    };
  }
}

// 导出单例
export const requestContext = new RequestContextStorage();
