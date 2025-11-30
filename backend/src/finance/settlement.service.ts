import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { QuerySettlementDto } from './dto';
import {
  SettlementStatus,
  TransactionType,
  ActivityStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DistributedLockService } from '../common/redis';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  // 平台服务费率
  private readonly PLATFORM_FEE_RATE = 0.05;
  // 结算延迟时间 (小时)
  private readonly SETTLEMENT_DELAY_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly lockService: DistributedLockService,
  ) {}

  /**
   * 生成结算单号
   */
  private generateSettlementNo(): string {
    const now = new Date();
    const datePart = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ST${datePart}${randomPart}`;
  }

  /**
   * 获取俱乐部结算列表
   */
  async getSettlements(clubId: string, query: QuerySettlementDto) {
    const { activityId, startDate, endDate, page = 1, limit = 10 } = query;

    const where: Prisma.SettlementWhereInput = {
      clubId,
      ...(activityId && { activityId }),
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      items: settlements.map((s) => ({
        id: s.id,
        settlementNo: s.settlementNo,
        activity: s.activity,
        totalAmount: s.totalAmount.toNumber(),
        platformFee: s.platformFee.toNumber(),
        refundAmount: s.refundAmount.toNumber(),
        settleAmount: s.settleAmount.toNumber(),
        status: s.status,
        settledAt: s.settledAt,
        createdAt: s.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取结算详情
   */
  async getSettlementById(clubId: string, settlementId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            maxPeople: true,
            price: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException('结算记录不存在');
    }

    if (settlement.clubId !== clubId) {
      throw new BadRequestException('无权访问');
    }

    // 获取活动订单统计
    const orderStats = await this.prisma.order.aggregate({
      where: {
        activityId: settlement.activityId,
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      },
      _count: true,
      _sum: { totalAmount: true },
    });

    return {
      id: settlement.id,
      settlementNo: settlement.settlementNo,
      activity: settlement.activity,
      totalAmount: settlement.totalAmount.toNumber(),
      platformFee: settlement.platformFee.toNumber(),
      refundAmount: settlement.refundAmount.toNumber(),
      settleAmount: settlement.settleAmount.toNumber(),
      commissionDetail: settlement.commissionDetail
        ? JSON.parse(settlement.commissionDetail)
        : null,
      status: settlement.status,
      settledAt: settlement.settledAt,
      createdAt: settlement.createdAt,
      orderCount: orderStats._count,
      orderTotal: orderStats._sum.totalAmount?.toNumber() || 0,
    };
  }

  /**
   * 手动触发结算 (管理员)
   * 使用分布式锁防止重复结算
   */
  async settleActivity(activityId: string) {
    const lockKey = `settlement:activity:${activityId}`;

    return this.lockService.withLock(
      lockKey,
      async () => {
        // 检查活动是否存在
        const activity = await this.prisma.activity.findUnique({
          where: { id: activityId },
          include: {
            settlement: true,
            club: true,
          },
        });

        if (!activity) {
          throw new NotFoundException('活动不存在');
        }

        // 检查是否已结算
        if (activity.settlement) {
          if (activity.settlement.status === SettlementStatus.COMPLETED) {
            throw new BadRequestException('活动已完成结算');
          }
          return this.executeSettlementCore(activity.settlement.id);
        }

        // 检查活动是否已结束
        if (activity.status !== ActivityStatus.COMPLETED) {
          throw new BadRequestException('活动尚未结束，无法结算');
        }

        // 创建结算记录并执行
        const settlement = await this.createSettlement(activity);
        return this.executeSettlementCore(settlement.id);
      },
      { ttlMs: 60000 }, // 60秒锁超时
    );
  }

  /**
   * 创建结算记录
   */
  private async createSettlement(activity: any) {
    // 计算订单总金额
    const orders = await this.prisma.order.findMany({
      where: {
        activityId: activity.id,
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      },
      include: {
        refund: true,
      },
    });

    // 计算收入和退款
    let totalAmount = 0;
    let refundAmount = 0;

    for (const order of orders) {
      totalAmount += order.totalAmount.toNumber();
      if (order.refund?.status === 'COMPLETED') {
        refundAmount += order.refund.amount.toNumber();
      }
    }

    // 计算平台服务费和结算金额
    const netAmount = totalAmount - refundAmount;
    const platformFee = netAmount * this.PLATFORM_FEE_RATE;
    const settleAmount = netAmount - platformFee;

    // 创建结算记录
    const settlement = await this.prisma.settlement.create({
      data: {
        settlementNo: this.generateSettlementNo(),
        activityId: activity.id,
        clubId: activity.clubId,
        totalAmount: new Prisma.Decimal(totalAmount),
        platformFee: new Prisma.Decimal(platformFee),
        refundAmount: new Prisma.Decimal(refundAmount),
        settleAmount: new Prisma.Decimal(settleAmount),
        commissionDetail: JSON.stringify({
          platformRate: this.PLATFORM_FEE_RATE * 100,
          platformFee,
          clubAmount: settleAmount,
        }),
        status: SettlementStatus.PENDING,
      },
    });

    this.logger.log(
      `Settlement created: ${settlement.settlementNo} for activity ${activity.id}`,
    );

    return settlement;
  }

  /**
   * 执行结算（带分布式锁）
   * 供自动结算任务调用
   */
  private async executeSettlement(settlementId: string) {
    const lockKey = `settlement:execute:${settlementId}`;

    const result = await this.lockService.tryWithLock(
      lockKey,
      async () => {
        return this.executeSettlementCore(settlementId);
      },
      { ttlMs: 60000, retryCount: 0 },
    );

    if (result === null) {
      this.logger.log(`Settlement ${settlementId} is already being processed`);
      return { success: false, reason: 'already_processing' };
    }

    return result;
  }

  /**
   * 执行结算核心逻辑
   * 注意：调用此方法前应确保已获取分布式锁
   */
  private async executeSettlementCore(settlementId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('结算记录不存在');
    }

    // 幂等性检查 - 在锁内再次检查状态
    if (settlement.status === SettlementStatus.COMPLETED) {
      this.logger.log(`Settlement already completed: ${settlement.settlementNo}`);
      return { success: true, alreadyCompleted: true };
    }

    const settleAmount = settlement.settleAmount.toNumber();

    await this.prisma.$transaction(async (tx) => {
      // 增加俱乐部余额
      await this.accountService.addBalance(settlement.clubId, settleAmount, tx);

      // 记录流水
      await this.transactionService.createTransaction(
        {
          clubId: settlement.clubId,
          activityId: settlement.activityId,
          amount: settleAmount,
          type: TransactionType.SETTLEMENT,
          description: `活动结算 ${settlement.settlementNo}`,
        },
        tx,
      );

      // 记录平台服务费流水
      if (settlement.platformFee.toNumber() > 0) {
        await this.transactionService.createTransaction(
          {
            clubId: settlement.clubId,
            activityId: settlement.activityId,
            amount: -settlement.platformFee.toNumber(),
            type: TransactionType.FEE,
            description: `平台服务费 ${settlement.settlementNo}`,
          },
          tx,
        );
      }

      // 更新结算状态
      await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          settledAt: new Date(),
        },
      });
    });

    this.logger.log(`Settlement completed: ${settlement.settlementNo}`);

    return { success: true };
  }

  /**
   * 定时任务: 自动结算已完成的活动
   * 活动结束后 24 小时自动结算
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoSettleActivities() {
    const settlementDeadline = new Date();
    settlementDeadline.setHours(
      settlementDeadline.getHours() - this.SETTLEMENT_DELAY_HOURS,
    );

    // 查找需要结算的活动
    const activities = await this.prisma.activity.findMany({
      where: {
        status: ActivityStatus.COMPLETED,
        endTime: { lte: settlementDeadline },
        settlement: null,
        orders: {
          some: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          },
        },
      },
      take: 50, // 每次最多处理50个
    });

    if (activities.length === 0) {
      return;
    }

    this.logger.log(`Auto-settling ${activities.length} activities`);

    for (const activity of activities) {
      try {
        const settlement = await this.createSettlement(activity);
        await this.executeSettlement(settlement.id);
      } catch (error) {
        this.logger.error(
          `Failed to settle activity ${activity.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * 获取待结算统计
   */
  async getPendingSettlementStats(clubId: string) {
    // 已完成未结算的活动
    const pendingActivities = await this.prisma.activity.findMany({
      where: {
        clubId,
        status: ActivityStatus.COMPLETED,
        settlement: null,
      },
      select: { id: true },
    });

    if (pendingActivities.length === 0) {
      return { count: 0, amount: 0 };
    }

    // 计算待结算金额
    const orders = await this.prisma.order.aggregate({
      where: {
        activityId: { in: pendingActivities.map((a) => a.id) },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      },
      _sum: { totalAmount: true },
    });

    const totalAmount = orders._sum.totalAmount?.toNumber() || 0;
    const estimatedSettle = totalAmount * (1 - this.PLATFORM_FEE_RATE);

    return {
      count: pendingActivities.length,
      amount: estimatedSettle,
    };
  }
}
