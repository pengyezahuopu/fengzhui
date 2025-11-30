import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderService } from '../order/order.service';
import {
  WechatPayService,
  PaymentNotification,
} from './wechat-pay.service';
import { PrepayDto } from './dto';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { DistributedLockService } from '../common/redis';
import { createLogger, requestContext } from '../common/observability';

@Injectable()
export class PaymentService {
  private readonly logger = createLogger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly wechatPayService: WechatPayService,
    private readonly lockService: DistributedLockService,
  ) {}

  /**
   * 预支付 - 发起微信支付
   */
  async prepay(userId: string, dto: PrepayDto) {
    // 1. 获取订单信息
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        activity: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('无权操作此订单');
    }

    // 2. 检查订单状态
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('订单状态不正确，无法支付');
    }

    // 3. 检查订单是否过期
    if (order.expiresAt < new Date()) {
      throw new BadRequestException('订单已过期，请重新下单');
    }

    // 4. 检查是否已有支付记录
    if (order.payment && order.payment.status === PaymentStatus.SUCCESS) {
      throw new BadRequestException('订单已支付');
    }

    // 5. 调用微信统一下单
    const totalFee = Math.round(order.totalAmount.toNumber() * 100); // 转为分
    const unifiedOrderResult = await this.wechatPayService.unifiedOrder({
      outTradeNo: order.orderNo,
      description: `${order.activity.title} - 活动报名`,
      totalFee,
      openId: dto.openId,
      attach: order.id, // 附加订单ID，用于回调时识别
    });

    // 6. 创建或更新支付记录
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        gateway: 'WECHAT',
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
        prepayId: unifiedOrderResult.prepayId,
        nonceStr: unifiedOrderResult.nonceStr,
        openId: dto.openId,
      },
      update: {
        prepayId: unifiedOrderResult.prepayId,
        nonceStr: unifiedOrderResult.nonceStr,
        status: PaymentStatus.PENDING,
        openId: dto.openId,
      },
    });

    // 7. 更新订单状态为支付中
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAYING },
    });

    // 8. 生成小程序端调起支付的参数
    const payParams = this.wechatPayService.generatePayParams(
      unifiedOrderResult.prepayId,
      unifiedOrderResult.nonceStr,
    );

    return payParams;
  }

  /**
   * 处理微信支付回调
   * 使用分布式锁保证幂等性，防止并发回调导致重复处理
   */
  async handleWechatNotify(
    notification: PaymentNotification,
    headers: {
      timestamp: string;
      nonce: string;
      signature: string;
      serial: string;
    },
    rawBody: string,
  ) {
    // 1. 验证签名
    const isValid = this.wechatPayService.verifyNotifySignature(
      headers.timestamp,
      headers.nonce,
      rawBody,
      headers.signature,
      headers.serial,
    );

    if (!isValid) {
      this.logger.warn('Invalid payment notify signature');
      throw new BadRequestException('签名验证失败');
    }

    // 2. 解密回调数据
    const paymentResult =
      this.wechatPayService.decryptNotifyResource(notification);

    this.logger.log('Payment notify received', {
      orderNo: paymentResult.out_trade_no,
      tradeState: paymentResult.trade_state,
      transactionId: paymentResult.transaction_id,
    });

    // 3. 使用分布式锁处理，防止并发回调
    const lockKey = `payment:notify:${paymentResult.out_trade_no}`;
    const result = await this.lockService.tryWithLock(
      lockKey,
      async () => {
        return this.processPaymentNotify(paymentResult);
      },
      { ttlMs: 30000, retryCount: 0 }, // 不重试，直接返回成功让微信重试
    );

    // 如果获取锁失败，说明另一个请求正在处理，直接返回成功
    if (result === null) {
      this.logger.log('Payment notify already processing, skipping', {
        orderNo: paymentResult.out_trade_no,
      });
      return { code: 'SUCCESS', message: '处理中' };
    }

    return result;
  }

  /**
   * 处理支付通知的核心逻辑
   */
  private async processPaymentNotify(paymentResult: {
    out_trade_no: string;
    trade_state: string;
    trade_state_desc: string;
    transaction_id: string;
  }) {
    // 1. 查找订单
    const order = await this.prisma.order.findFirst({
      where: { orderNo: paymentResult.out_trade_no },
      include: { payment: true },
    });

    if (!order) {
      this.logger.error('Order not found for payment notify', {
        orderNo: paymentResult.out_trade_no,
      });
      // 返回成功，避免微信重复通知
      return { code: 'SUCCESS', message: '处理成功' };
    }

    // 设置用户上下文（用于后续日志）
    requestContext.setUserId(order.userId);
    requestContext.setExtra('orderId', order.id);

    // 2. 幂等性检查 - 在锁内再次检查状态
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
      this.logger.log('Order already paid, skipping', {
        orderId: order.id,
        orderNo: order.orderNo,
        status: order.status,
      });
      return { code: 'SUCCESS', message: '处理成功' };
    }

    // 3. 处理支付结果
    if (paymentResult.trade_state === 'SUCCESS') {
      await this.handlePaymentSuccess(order.id, paymentResult.transaction_id);
    } else {
      await this.handlePaymentFail(order.id, paymentResult.trade_state_desc);
    }

    return { code: 'SUCCESS', message: '处理成功' };
  }

  /**
   * 支付成功处理
   */
  private async handlePaymentSuccess(orderId: string, transactionId: string) {
    await this.prisma.$transaction(async (tx) => {
      // 更新支付记录
      await tx.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.SUCCESS,
          transactionId,
        },
      });
    });

    // 调用 OrderService 处理订单状态更新
    await this.orderService.handlePaymentSuccess(orderId);

    // 使用审计日志记录关键业务操作
    this.logger.audit('Payment success', {
      orderId,
      transactionId,
    });
  }

  /**
   * 支付失败处理
   */
  private async handlePaymentFail(orderId: string, _failReason: string) {
    await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.FAILED,
        // 注: failReason 未在 schema 中定义，可在后续版本添加
      },
    });

    // 订单状态恢复为待支付
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PENDING },
    });

    this.logger.warn('Payment failed', {
      orderId,
      reason: _failReason,
    });
  }

  /**
   * 查询支付状态 (主动同步)
   */
  async syncPaymentStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 已支付订单无需同步
    if (order.status === OrderStatus.PAID) {
      return { status: 'paid', needUpdate: false };
    }

    // 查询微信支付状态
    const queryResult = await this.wechatPayService.queryOrder(order.orderNo);

    if (!queryResult) {
      return { status: 'unknown', needUpdate: false };
    }

    // 处理查询结果 (此时 order.status 已经不是 PAID，由上方 TypeScript 类型收窄保证)
    if (queryResult.trade_state === 'SUCCESS') {
      await this.handlePaymentSuccess(order.id, queryResult.transaction_id);
      return { status: 'paid', needUpdate: true };
    }

    return { status: queryResult.trade_state.toLowerCase(), needUpdate: false };
  }


  /**
   * 模拟支付成功 (仅开发环境使用)
   * 用于 H5 端到端测试
   */
  async mockPaymentSuccess(userId: string, orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('此功能仅在开发环境可用');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('无权操作此订单');
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
      return { success: true, message: '订单已支付', status: order.status };
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYING) {
      throw new BadRequestException(`订单状态 ${order.status} 不允许模拟支付`);
    }

    // 确保有支付记录
    if (!order.payment) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: 'MOCK',
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
          nonceStr: `mock_${Date.now()}`,
        },
      });
    }

    // 模拟支付成功
    const mockTransactionId = `MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await this.handlePaymentSuccess(order.id, mockTransactionId);

    this.logger.log('Mock payment success', {
      orderId,
      mockTransactionId,
    });

    return {
      success: true,
      message: '模拟支付成功',
      transactionId: mockTransactionId,
    };
  }

  /**
   * 获取支付详情
   */
  async getPaymentDetail(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        activity: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('无权访问此订单');
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.totalAmount,
      status: order.status,
      payment: order.payment,
      activity: order.activity,
    };
  }
}
