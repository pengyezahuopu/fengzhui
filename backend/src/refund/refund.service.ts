import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WechatPayService } from '../payment/wechat-pay.service';
import { CreateRefundDto, RefundPreviewResult } from './dto';
import {
  OrderStatus,
  RefundStatus,
  RefundReason,
  Prisma,
} from '@prisma/client';

interface RefundRule {
  hoursBeforeStart: number;
  refundPercent: number;
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPayService: WechatPayService,
  ) {}

  /**
   * 生成退款单号
   */
  private generateRefundNo(): string {
    const now = new Date();
    const datePart = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RF${datePart}${randomPart}`;
  }

  /**
   * 计算退款金额 (根据退款策略)
   */
  private calculateRefundAmount(
    orderAmount: number,
    activityStartTime: Date,
    rules: RefundRule[],
    noRefundHours: number,
  ): { amount: number; percent: number; canRefund: boolean } {
    const now = new Date();
    const hoursUntilStart =
      (activityStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 检查是否在不可退款时间内
    if (hoursUntilStart < noRefundHours) {
      return { amount: 0, percent: 0, canRefund: false };
    }

    // 按规则计算退款比例
    // 规则按 hoursBeforeStart 从大到小排序
    const sortedRules = [...rules].sort(
      (a, b) => b.hoursBeforeStart - a.hoursBeforeStart,
    );

    for (const rule of sortedRules) {
      if (hoursUntilStart >= rule.hoursBeforeStart) {
        const amount = (orderAmount * rule.refundPercent) / 100;
        return { amount, percent: rule.refundPercent, canRefund: true };
      }
    }

    // 如果没有匹配的规则，使用最后一个规则
    if (sortedRules.length > 0) {
      const lastRule = sortedRules[sortedRules.length - 1];
      const amount = (orderAmount * lastRule.refundPercent) / 100;
      return { amount, percent: lastRule.refundPercent, canRefund: true };
    }

    return { amount: 0, percent: 0, canRefund: false };
  }

  /**
   * 获取退款策略
   */
  private async getRefundPolicy(activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        refundPolicy: true,
        club: {
          include: {
            refundPolicies: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 优先使用活动级退款策略，否则使用俱乐部默认策略
    const policy =
      activity.refundPolicy || activity.club?.refundPolicies?.[0];

    if (!policy) {
      // 使用平台默认策略
      return {
        rules: [
          { hoursBeforeStart: 168, refundPercent: 100 }, // 7天以上全退
          { hoursBeforeStart: 72, refundPercent: 80 }, // 3-7天退80%
          { hoursBeforeStart: 24, refundPercent: 50 }, // 1-3天退50%
        ] as RefundRule[],
        noRefundHours: 24,
        cancelRefundPercent: 100,
      };
    }

    return {
      rules: JSON.parse(policy.rules) as RefundRule[],
      noRefundHours: policy.noRefundHours,
      cancelRefundPercent: policy.cancelRefundPercent,
    };
  }

  /**
   * 预览退款金额
   */
  async previewRefund(
    userId: string,
    orderId: string,
  ): Promise<RefundPreviewResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        activity: true,
        refund: true,
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('无权操作此订单');
    }

    // 检查订单状态
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('只有已支付订单可以申请退款');
    }

    // 检查是否已有退款记录
    if (order.refund) {
      throw new BadRequestException('该订单已有退款申请');
    }

    // 检查活动是否已开始
    if (new Date() >= order.activity.startTime) {
      return {
        orderId,
        orderAmount: order.totalAmount.toNumber(),
        refundAmount: 0,
        refundPercent: 0,
        reason: '活动已开始，无法退款',
        canRefund: false,
      };
    }

    // 获取退款策略并计算
    const policy = await this.getRefundPolicy(order.activityId);
    const result = this.calculateRefundAmount(
      order.totalAmount.toNumber(),
      order.activity.startTime,
      policy.rules,
      policy.noRefundHours,
    );

    return {
      orderId,
      orderAmount: order.totalAmount.toNumber(),
      refundAmount: result.amount,
      refundPercent: result.percent,
      reason: result.canRefund
        ? `可退款 ${result.percent}%`
        : '已超过可退款时间',
      canRefund: result.canRefund,
    };
  }

  /**
   * 申请退款
   */
  async createRefund(userId: string, dto: CreateRefundDto) {
    // 先预览确认可以退款
    const preview = await this.previewRefund(userId, dto.orderId);

    if (!preview.canRefund) {
      throw new BadRequestException(preview.reason);
    }

    // 创建退款记录
    const refund = await this.prisma.$transaction(async (tx) => {
      // 创建退款记录
      const newRefund = await tx.refund.create({
        data: {
          orderId: dto.orderId,
          refundNo: this.generateRefundNo(),
          amount: new Prisma.Decimal(preview.refundAmount),
          reason: dto.reason,
          reasonDetail: dto.reasonDetail,
          status: RefundStatus.PENDING,
        },
        include: {
          order: {
            include: {
              activity: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      // 更新订单状态为退款中
      await tx.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.REFUNDING },
      });

      return newRefund;
    });

    this.logger.log(
      `Refund created: ${refund.refundNo}, amount: ${refund.amount}`,
    );

    return refund;
  }

  /**
   * 获取用户的退款列表
   */
  async getUserRefunds(
    userId: string,
    query: { page?: number; limit?: number; status?: RefundStatus },
  ) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.RefundWhereInput = {
      order: { userId },
      ...(status && { status }),
    };

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          order: {
            include: {
              activity: {
                select: { id: true, title: true, coverUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      items: refunds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取退款详情
   */
  async getRefundById(userId: string, refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            activity: {
              select: { id: true, title: true, coverUrl: true, startTime: true },
            },
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.order.userId !== userId) {
      throw new ForbiddenException('无权访问此退款记录');
    }

    return refund;
  }

  /**
   * 审批通过退款 (俱乐部管理员)
   */
  async approveRefund(adminUserId: string, refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            activity: { include: { club: true } },
            payment: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException('该退款申请已处理');
    }

    // TODO: 验证 adminUserId 是否有权限审批此俱乐部的退款

    // 更新状态为已通过，准备执行退款
    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.APPROVED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });

    // 自动执行退款
    await this.processRefund(refundId);

    return updatedRefund;
  }

  /**
   * 拒绝退款 (俱乐部管理员)
   */
  async rejectRefund(
    adminUserId: string,
    refundId: string,
    rejectReason: string,
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException('该退款申请已处理');
    }

    // 更新退款状态
    const updatedRefund = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.REJECTED,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectReason,
        },
      });

      // 恢复订单状态
      await tx.order.update({
        where: { id: refund.orderId },
        data: { status: OrderStatus.PAID },
      });

      return updated;
    });

    this.logger.log(`Refund rejected: ${refund.refundNo}`);

    return updatedRefund;
  }

  /**
   * 执行退款 (调用微信退款接口)
   */
  async processRefund(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: { include: { payment: true } },
      },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (
      refund.status !== RefundStatus.APPROVED &&
      refund.status !== RefundStatus.PENDING
    ) {
      throw new BadRequestException('退款状态不正确');
    }

    // 更新为处理中
    await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: RefundStatus.PROCESSING },
    });

    try {
      // 调用微信退款接口
      const refundResult = await this.wechatPayService.refund({
        outTradeNo: refund.order.orderNo,
        outRefundNo: refund.refundNo,
        refundAmount: Math.round(refund.amount.toNumber() * 100),
        totalAmount: Math.round(refund.order.totalAmount.toNumber() * 100),
        reason: refund.reasonDetail || '用户申请退款',
      });

      if (refundResult) {
        // 退款成功
        await this.prisma.$transaction(async (tx) => {
          await tx.refund.update({
            where: { id: refundId },
            data: {
              status: RefundStatus.COMPLETED,
              wxRefundId: refundResult.refundId,
            },
          });

          await tx.order.update({
            where: { id: refund.orderId },
            data: {
              status: OrderStatus.REFUNDED,
              refundedAt: new Date(),
            },
          });
        });

        this.logger.log(
          `Refund processed successfully: ${refund.refundNo}`,
        );
      } else {
        // 退款失败，恢复状态
        await this.prisma.refund.update({
          where: { id: refundId },
          data: { status: RefundStatus.APPROVED },
        });

        throw new BadRequestException('微信退款失败');
      }
    } catch (error) {
      this.logger.error(`Refund processing failed: ${refund.refundNo}`, error);

      // 恢复状态
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.APPROVED },
      });

      throw error;
    }
  }

  /**
   * 获取俱乐部的待审批退款列表 (管理员)
   */
  async getClubPendingRefunds(clubId: string) {
    return this.prisma.refund.findMany({
      where: {
        status: RefundStatus.PENDING,
        order: {
          activity: { clubId },
        },
      },
      include: {
        order: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
            activity: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
