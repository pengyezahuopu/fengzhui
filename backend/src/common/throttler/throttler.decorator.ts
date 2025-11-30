import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * 严格限流 - 用于敏感接口（登录、短信、支付）
 * 10次/分钟
 */
export function StrictThrottle() {
  return applyDecorators(
    Throttle({ medium: { ttl: 60000, limit: 10 } }),
  );
}

/**
 * 宽松限流 - 用于查询接口
 * 200次/分钟
 */
export function RelaxedThrottle() {
  return applyDecorators(
    Throttle({ medium: { ttl: 60000, limit: 200 } }),
  );
}

/**
 * 超严格限流 - 用于短信发送等高成本操作
 * 5次/分钟, 20次/小时
 */
export function UltraStrictThrottle() {
  return applyDecorators(
    Throttle({
      medium: { ttl: 60000, limit: 5 },
      long: { ttl: 3600000, limit: 20 },
    }),
  );
}

/**
 * 跳过限流 - 用于内部接口或健康检查
 */
export { SkipThrottle };
