import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { QueryTransactionDto } from './dto';
import { TransactionType, TransactionStatus, Prisma } from '@prisma/client';
import { AccountService } from './account.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
  ) {}

  /**
   * 获取俱乐部流水列表
   */
  async getTransactions(clubId: string, query: QueryTransactionDto) {
    const { activityId, type, startDate, endDate, page = 1, limit = 20 } = query;

    const where: Prisma.TransactionWhereInput = {
      clubId,
      ...(activityId && { activityId }),
      ...(type && { type }),
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

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          activity: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toNumber(),
        description: t.description,
        activity: t.activity,
        balanceBefore: t.balanceBefore.toNumber(),
        balanceAfter: t.balanceAfter.toNumber(),
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建流水记录 (内部使用)
   */
  async createTransaction(
    data: {
      clubId: string;
      activityId?: string;
      orderId?: string;
      amount: number;
      type: TransactionType;
      description?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;

    // 获取当前余额
    const account = await this.accountService.getOrCreateAccount(data.clubId);
    const balanceBefore = account.balance.toNumber();
    const balanceAfter = balanceBefore + data.amount;

    const transaction = await prismaClient.transaction.create({
      data: {
        clubId: data.clubId,
        activityId: data.activityId,
        orderId: data.orderId,
        amount: new Prisma.Decimal(data.amount),
        type: data.type,
        status: TransactionStatus.COMPLETED,
        balanceBefore: new Prisma.Decimal(balanceBefore),
        balanceAfter: new Prisma.Decimal(balanceAfter),
        description: data.description,
      },
    });

    this.logger.log(
      `Transaction created: ${data.type} ${data.amount} for club ${data.clubId}`,
    );

    return transaction;
  }

  /**
   * 获取月度统计
   */
  async getMonthlyStats(clubId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        clubId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const stats = {
      income: 0,
      refund: 0,
      withdrawal: 0,
      platformFee: 0,
      settlement: 0,
    };

    for (const t of transactions) {
      const amount = t.amount.toNumber();
      switch (t.type) {
        case TransactionType.INCOME:
          stats.income += amount;
          break;
        case TransactionType.REFUND:
          stats.refund += Math.abs(amount);
          break;
        case TransactionType.WITHDRAWAL:
          stats.withdrawal += Math.abs(amount);
          break;
        case TransactionType.FEE:
          stats.platformFee += Math.abs(amount);
          break;
        case TransactionType.SETTLEMENT:
          stats.settlement += amount;
          break;
      }
    }

    return {
      year,
      month,
      ...stats,
      netIncome: stats.income - stats.refund - stats.platformFee,
    };
  }

  /**
   * 获取财务报表
   */
  async getFinanceReport(clubId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        clubId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 按日期分组统计
    const dailyStats: Record<string, {
      income: number;
      refund: number;
      withdrawal: number;
      platformFee: number;
    }> = {};

    for (const t of transactions) {
      const dateKey = t.createdAt.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { income: 0, refund: 0, withdrawal: 0, platformFee: 0 };
      }

      const amount = t.amount.toNumber();
      switch (t.type) {
        case TransactionType.INCOME:
        case TransactionType.SETTLEMENT:
          dailyStats[dateKey].income += amount;
          break;
        case TransactionType.REFUND:
          dailyStats[dateKey].refund += Math.abs(amount);
          break;
        case TransactionType.WITHDRAWAL:
          dailyStats[dateKey].withdrawal += Math.abs(amount);
          break;
        case TransactionType.FEE:
          dailyStats[dateKey].platformFee += Math.abs(amount);
          break;
      }
    }

    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
      netIncome: stats.income - stats.refund - stats.platformFee,
    }));
  }
}
