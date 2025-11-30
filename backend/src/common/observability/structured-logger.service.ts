import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { requestContext } from './request-context';

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 结构化日志条目
 */
export interface LogEntry {
  /** 时间戳 (ISO 8601) */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 请求ID */
  requestId?: string;
  /** 用户ID */
  userId?: string;
  /** 模块/服务名称 */
  context?: string;
  /** 请求路径 */
  path?: string;
  /** 请求耗时 (ms) */
  duration?: number;
  /** 额外数据 */
  data?: Record<string, any>;
  /** 错误堆栈 */
  stack?: string;
}

/**
 * 结构化日志服务
 * 输出 JSON 格式日志，便于 ELK/Loki 索引和检索
 */
@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private contextName: string = 'Application';
  private readonly isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * 设置日志上下文名称（通常是类名）
   */
  setContext(context: string) {
    this.contextName = context;
    return this;
  }

  /**
   * Debug 级别日志
   */
  debug(message: string, data?: Record<string, any>) {
    this.writeLog('debug', message, data);
  }

  /**
   * Info 级别日志
   */
  log(message: string, data?: Record<string, any>) {
    this.writeLog('info', message, data);
  }

  /**
   * Warn 级别日志
   */
  warn(message: string, data?: Record<string, any>) {
    this.writeLog('warn', message, data);
  }

  /**
   * Error 级别日志
   * 支持多种调用方式：
   * - error(message)
   * - error(message, trace)
   * - error(message, data)
   * - error(message, trace, data)
   */
  error(message: string, traceOrData?: string | Record<string, any>, data?: Record<string, any>) {
    if (typeof traceOrData === 'string') {
      // error(message, trace) 或 error(message, trace, data)
      this.writeLog('error', message, { ...data, stack: traceOrData });
    } else if (typeof traceOrData === 'object') {
      // error(message, data)
      this.writeLog('error', message, traceOrData);
    } else {
      // error(message)
      this.writeLog('error', message);
    }
  }

  /**
   * 记录业务操作日志
   * 用于关键业务节点的审计追踪
   */
  audit(action: string, data: Record<string, any>) {
    this.writeLog('info', `[AUDIT] ${action}`, {
      ...data,
      audit: true,
    });
  }

  /**
   * 记录性能指标
   */
  metric(name: string, value: number, tags?: Record<string, string>) {
    this.writeLog('info', `[METRIC] ${name}`, {
      metricName: name,
      metricValue: value,
      tags,
    });
  }

  /**
   * 写入日志
   */
  private writeLog(level: LogLevel, message: string, data?: Record<string, any>) {
    const ctx = requestContext.getContext();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.contextName,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      path: ctx?.path,
      duration: ctx ? Date.now() - ctx.startTime : undefined,
      data: this.sanitizeData(data),
    };

    // 如果有错误堆栈，单独提取
    if (data?.stack) {
      entry.stack = data.stack;
      if (entry.data) {
        delete entry.data.stack;
      }
    }

    // 移除 undefined 字段
    const cleanEntry = this.removeUndefined(entry) as LogEntry;

    // 输出日志
    if (this.isDevelopment) {
      // 开发环境：格式化输出，便于阅读
      this.writeDevLog(level, cleanEntry);
    } else {
      // 生产环境：JSON 格式，便于日志系统收集
      console.log(JSON.stringify(cleanEntry));
    }
  }

  /**
   * 开发环境格式化输出
   */
  private writeDevLog(level: LogLevel, entry: LogEntry) {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = colors[level];

    const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`;
    const ctx = entry.context ? `\x1b[33m[${entry.context}]${reset}` : '';
    const reqId = entry.requestId ? `\x1b[90m(${entry.requestId})${reset}` : '';
    const duration = entry.duration !== undefined ? `\x1b[90m+${entry.duration}ms${reset}` : '';

    let output = `${prefix} ${ctx} ${entry.message} ${reqId} ${duration}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      output += `\n  ${JSON.stringify(entry.data)}`;
    }

    if (entry.stack) {
      output += `\n${entry.stack}`;
    }

    console.log(output);
  }

  /**
   * 清理敏感数据
   */
  private sanitizeData(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return undefined;

    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'bankAccount', 'idCard'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 移除 undefined 字段
   */
  private removeUndefined(obj: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }
}

/**
 * 创建带上下文的 Logger 实例
 */
export function createLogger(context: string): StructuredLoggerService {
  return new StructuredLoggerService().setContext(context);
}
