import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from './request-context';

/**
 * 请求上下文中间件
 * 为每个请求生成唯一的 Request ID，并注入到 AsyncLocalStorage
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 从请求头获取或生成新的 Request ID
    const requestId = (req.headers['x-request-id'] as string) || undefined;

    // 创建请求上下文
    const context = requestContext.createContext({
      requestId,
      path: req.path,
      method: req.method,
    });

    // 设置响应头，返回 Request ID
    res.setHeader('x-request-id', context.requestId);

    // 在上下文中运行后续中间件和路由处理
    requestContext.run(context, () => {
      next();
    });
  }
}
