import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { ClubModule } from './club/club.module';
import { LeaderModule } from './leader/leader.module';
import { UserModule } from './user/user.module';
import { RouteModule } from './route/route.module';
import { ActivityModule } from './activity/activity.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { GisModule } from './gis/gis.module';
// Common modules
import { RedisModule } from './common/redis';
import { CryptoModule } from './common/crypto';
import { ObservabilityModule } from './common/observability';
import { AppThrottlerModule } from './common/throttler';
import { ContentSecurityModule } from './common/content-security';
// Phase 3: Social modules
import { SocialModule } from './social/social.module';
// Phase 4: Order & Payment
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { RefundModule } from './refund/refund.module';
import { InsuranceModule } from './insurance/insurance.module';
import { VerificationModule } from './verification/verification.module';
import { FinanceModule } from './finance/finance.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    // 事件系统 (用于异步通知、成就触发等)
    EventEmitterModule.forRoot(),
    // 定时任务调度
    ScheduleModule.forRoot(),
    // 文件上传配置
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB 文件大小限制
      },
    }),
    // Redis (缓存、分布式锁、排行榜)
    RedisModule,
    // 加密服务 (敏感数据保护)
    CryptoModule,
    // 可观测性 (Request ID, 结构化日志)
    ObservabilityModule,
    // 接口限流
    AppThrottlerModule,
    PrismaModule,
    UserModule,
    ClubModule,
    LeaderModule,
    RouteModule,
    ActivityModule,
    EnrollmentModule,
    GisModule,
    // Phase 3: Social
    ContentSecurityModule,
    SocialModule,
    // Phase 4: Order & Payment
    OrderModule,
    PaymentModule,
    RefundModule,
    InsuranceModule,
    VerificationModule,
    FinanceModule,
    // 系统管理
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
