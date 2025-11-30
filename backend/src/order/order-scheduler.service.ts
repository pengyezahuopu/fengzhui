import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderSchedulerService {
  private readonly logger = new Logger(OrderSchedulerService.name);
  private isRunning = false;

  constructor(private readonly orderService: OrderService) {}

  /**
   * 每分钟检查并取消超时订单
   * 使用锁防止并发执行
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    // 防止重复执行
    if (this.isRunning) {
      this.logger.debug('Previous job still running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.orderService.cancelExpiredOrders();

      if (result.cancelledCount > 0) {
        this.logger.log(
          `Cancelled ${result.cancelledCount} expired order(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cancel expired orders', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 每5分钟同步待处理订单的支付状态
   * 用于处理微信回调丢失的情况
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncPendingPayments() {
    // 防止重复执行
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // 查询超过3分钟但未超时的支付中订单
      // 这些订单可能已经支付成功但回调丢失
      // TODO: 实现批量同步支付状态
      this.logger.debug('Checking pending payments...');
    } catch (error) {
      this.logger.error('Failed to sync pending payments', error);
    } finally {
      this.isRunning = false;
    }
  }
}
