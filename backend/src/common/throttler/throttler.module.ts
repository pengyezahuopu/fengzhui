import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

/**
 * 限流配置模块
 *
 * 默认配置：
 * - short: 10次/秒 (防止瞬时高频请求)
 * - medium: 100次/分钟 (常规接口限制)
 * - long: 1000次/小时 (防止持续攻击)
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1秒
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000, // 1分钟
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600000, // 1小时
        limit: 1000,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppThrottlerModule {}
