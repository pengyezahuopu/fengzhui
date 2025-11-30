import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 对所有路由应用请求上下文中间件
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
