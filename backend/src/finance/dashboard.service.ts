import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityStatus, OrderStatus } from '@prisma/client';
import { AccountService } from './account.service';
import { SettlementService } from './settlement.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * 获取俱乐部 Dashboard 数据
   */
  async getDashboardStats(clubId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 并行获取各项统计数据
    const [
      accountDetail,
      pendingSettlement,
      activityStats,
      monthlyStats,
      recentActivities,
      recentTransactions,
    ] = await Promise.all([
      // 账户余额信息
      this.accountService.getAccountDetail(clubId),

      // 待结算统计
      this.settlementService.getPendingSettlementStats(clubId),

      // 活动统计
      this.getActivityStats(clubId),

      // 月度统计
      this.getMonthlyStats(clubId, startOfMonth),

      // 最近活动
      this.getRecentActivities(clubId),

      // 最近流水
      this.getRecentTransactions(clubId),
    ]);

    return {
      overview: {
        balance: accountDetail.balance,
        availableBalance: accountDetail.availableBalance,
        frozenBalance: accountDetail.frozenBalance,
        totalIncome: accountDetail.totalIncome,
        totalWithdraw: accountDetail.totalWithdraw,
        pendingSettlementCount: pendingSettlement.count,
        pendingSettlementAmount: pendingSettlement.amount,
        hasBankAccount: accountDetail.hasBankAccount,
      },
      monthlyStats,
      activityStats,
      recentActivities,
      recentTransactions,
    };
  }

  /**
   * 获取活动统计
   */
  private async getActivityStats(clubId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 活动总数统计
    const [total, active, completed, monthlyEnrollments] = await Promise.all([
      this.prisma.activity.count({ where: { clubId } }),
      this.prisma.activity.count({
        where: {
          clubId,
          status: { in: [ActivityStatus.PUBLISHED, ActivityStatus.FULL] },
        },
      }),
      this.prisma.activity.count({
        where: { clubId, status: ActivityStatus.COMPLETED },
      }),
      this.prisma.order.count({
        where: {
          activity: { clubId },
          status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    // 总报名数
    const totalEnrollments = await this.prisma.order.count({
      where: {
        activity: { clubId },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      },
    });

    return {
      total,
      active,
      completed,
      totalEnrollments,
      monthlyEnrollments,
    };
  }

  /**
   * 获取月度统计
   */
  private async getMonthlyStats(clubId: string, startOfMonth: Date) {
    const endOfMonth = new Date(
      startOfMonth.getFullYear(),
      startOfMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // 月度订单收入
    const monthlyOrders = await this.prisma.order.aggregate({
      where: {
        activity: { clubId },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // 月度退款
    const monthlyRefunds = await this.prisma.refund.aggregate({
      where: {
        order: { activity: { clubId } },
        status: 'COMPLETED',
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    });

    const income = monthlyOrders._sum.totalAmount?.toNumber() || 0;
    const refund = monthlyRefunds._sum.amount?.toNumber() || 0;

    return {
      income,
      refund,
      netIncome: income - refund,
      orderCount: monthlyOrders._count,
      month: startOfMonth.getMonth() + 1,
      year: startOfMonth.getFullYear(),
    };
  }

  /**
   * 获取最近活动
   */
  private async getRecentActivities(clubId: string, limit = 5) {
    const activities = await this.prisma.activity.findMany({
      where: { clubId },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return activities.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      startTime: a.startTime,
      endTime: a.endTime,
      maxPeople: a.maxPeople,
      currentPeople: a.orders.length, // 根据已支付订单计算当前人数
      price: a.price.toNumber(),
      enrollmentCount: a.orders.length,
    }));
  }

  /**
   * 获取最近流水
   */
  private async getRecentTransactions(clubId: string, limit = 10) {
    const transactions = await this.prisma.transaction.findMany({
      where: { clubId },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        activity: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      description: t.description,
      activity: t.activity,
      createdAt: t.createdAt,
    }));
  }

  /**
   * 获取收入趋势 (近7天/30天)
   */
  async getIncomeTrend(clubId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 获取指定天数内的订单
    const orders = await this.prisma.order.findMany({
      where: {
        activity: { clubId },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        createdAt: { gte: startDate },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    // 按日期分组统计
    const dailyStats: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = 0;
    }

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (dailyStats[dateKey] !== undefined) {
        dailyStats[dateKey] += order.totalAmount.toNumber();
      }
    }

    return Object.entries(dailyStats)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 获取活动排行榜
   */
  async getActivityRanking(clubId: string, limit = 10) {
    const activities = await this.prisma.activity.findMany({
      where: {
        clubId,
        status: { in: [ActivityStatus.COMPLETED, ActivityStatus.PUBLISHED, ActivityStatus.FULL] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        price: true,
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          },
          select: {
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // 获取最近50个活动进行排序
    });

    // 计算每个活动的总收入并排序
    const ranked = activities
      .map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        price: a.price.toNumber(),
        enrollmentCount: a.orders.length,
        totalIncome: a.orders.reduce(
          (sum, o) => sum + o.totalAmount.toNumber(),
          0,
        ),
      }))
      .sort((a, b) => b.totalIncome - a.totalIncome)
      .slice(0, limit);

    return ranked;
  }
}
