import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWithdrawalDto, QueryWithdrawalDto } from './dto';
import { WithdrawalStatus, TransactionType, ClubRole, Prisma } from '@prisma/client';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  // 最低提现金额
  private readonly MIN_WITHDRAWAL = 100;
  // 提现手续费率
  private readonly WITHDRAWAL_FEE_RATE = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * 生成提现单号
   */
  private generateWithdrawalNo(): string {
    const now = new Date();
    const datePart = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `WD${datePart}${randomPart}`;
  }

  /**
   * 申请提现
   */
  async createWithdrawal(userId: string, clubId: string, dto: CreateWithdrawalDto) {
    // 1. 验证权限
    const hasPermission = await this.checkClubPermission(userId, clubId);
    if (!hasPermission) {
      throw new ForbiddenException('无权操作');
    }

    // 2. 检查账户状态
    const account = await this.accountService.getOrCreateAccount(clubId);

    if (!account.bankName || !account.bankAccount) {
      throw new BadRequestException('请先设置提现账户');
    }

    // 3. 检查余额
    const availableBalance = account.balance.toNumber() - account.frozenBalance.toNumber();
    if (dto.amount > availableBalance) {
      throw new BadRequestException(`可用余额不足，当前可提现: ¥${availableBalance.toFixed(2)}`);
    }

    if (dto.amount < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(`最低提现金额为 ¥${this.MIN_WITHDRAWAL}`);
    }

    // 4. 计算手续费
    const fee = dto.amount * this.WITHDRAWAL_FEE_RATE;
    const actualAmount = dto.amount - fee;

    // 5. 创建提现申请并冻结余额
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      // 冻结余额
      await this.accountService.freezeBalance(clubId, dto.amount, tx);

      // 创建提现记录
      return tx.withdrawal.create({
        data: {
          withdrawalNo: this.generateWithdrawalNo(),
          clubId,
          amount: new Prisma.Decimal(dto.amount),
          fee: new Prisma.Decimal(fee),
          actualAmount: new Prisma.Decimal(actualAmount),
          status: WithdrawalStatus.PENDING,
        },
      });
    });

    this.logger.log(`Withdrawal created: ${withdrawal.withdrawalNo} for club ${clubId}`);

    return {
      id: withdrawal.id,
      withdrawalNo: withdrawal.withdrawalNo,
      amount: withdrawal.amount.toNumber(),
      fee: withdrawal.fee.toNumber(),
      actualAmount: withdrawal.actualAmount.toNumber(),
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    };
  }

  /**
   * 获取提现列表
   */
  async getWithdrawals(clubId: string, query: QueryWithdrawalDto) {
    const { status, page = 1, limit = 10 } = query;

    const where: Prisma.WithdrawalWhereInput = {
      clubId,
      ...(status && { status }),
    };

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return {
      items: withdrawals.map((w) => ({
        id: w.id,
        withdrawalNo: w.withdrawalNo,
        amount: w.amount.toNumber(),
        fee: w.fee.toNumber(),
        actualAmount: w.actualAmount.toNumber(),
        status: w.status,
        rejectReason: w.rejectReason,
        createdAt: w.createdAt,
        reviewedAt: w.reviewedAt,
        transferredAt: w.transferredAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取提现详情
   */
  async getWithdrawalById(clubId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        club: {
          select: { id: true, name: true },
        },
      },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.clubId !== clubId) {
      throw new ForbiddenException('无权访问');
    }

    return {
      id: withdrawal.id,
      withdrawalNo: withdrawal.withdrawalNo,
      amount: withdrawal.amount.toNumber(),
      fee: withdrawal.fee.toNumber(),
      actualAmount: withdrawal.actualAmount.toNumber(),
      status: withdrawal.status,
      rejectReason: withdrawal.rejectReason,
      createdAt: withdrawal.createdAt,
      reviewedAt: withdrawal.reviewedAt,
      transferredAt: withdrawal.transferredAt,
      club: withdrawal.club,
    };
  }

  /**
   * 审批通过提现 (管理员)
   */
  async approveWithdrawal(adminUserId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('该提现申请已处理');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Withdrawal approved: ${withdrawal.withdrawalNo}`);

    return updated;
  }

  /**
   * 拒绝提现 (管理员)
   */
  async rejectWithdrawal(adminUserId: string, withdrawalId: string, rejectReason: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('该提现申请已处理');
    }

    // 拒绝提现，解冻余额
    await this.prisma.$transaction(async (tx) => {
      // 解冻余额
      await this.accountService.unfreezeBalance(
        withdrawal.clubId,
        withdrawal.amount.toNumber(),
        tx,
      );

      // 更新提现状态
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.REJECTED,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          rejectReason,
        },
      });
    });

    this.logger.log(`Withdrawal rejected: ${withdrawal.withdrawalNo}`);

    return { success: true };
  }

  /**
   * 完成提现 (管理员确认打款)
   */
  async completeWithdrawal(adminUserId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException('该提现申请未审批或已处理');
    }

    // 完成提现
    await this.prisma.$transaction(async (tx) => {
      // 完成提现，扣除余额
      await this.accountService.completeWithdrawal(
        withdrawal.clubId,
        withdrawal.amount.toNumber(),
        tx,
      );

      // 记录流水
      await this.transactionService.createTransaction(
        {
          clubId: withdrawal.clubId,
          amount: -withdrawal.amount.toNumber(),
          type: TransactionType.WITHDRAWAL,
          description: `提现 ${withdrawal.withdrawalNo}`,
        },
        tx,
      );

      // 更新提现状态
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.COMPLETED,
          transferredAt: new Date(),
        },
      });
    });

    this.logger.log(`Withdrawal completed: ${withdrawal.withdrawalNo}`);

    return { success: true };
  }

  /**
   * 获取待处理提现列表 (管理员)
   */
  async getPendingWithdrawals(page = 1, limit = 20) {
    const where: Prisma.WithdrawalWhereInput = {
      status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] },
    };

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        include: {
          club: {
            select: {
              id: true,
              name: true,
              account: {
                select: {
                  bankName: true,
                  bankAccount: true,
                  accountName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return {
      items: withdrawals.map((w) => ({
        id: w.id,
        withdrawalNo: w.withdrawalNo,
        amount: w.amount.toNumber(),
        fee: w.fee.toNumber(),
        actualAmount: w.actualAmount.toNumber(),
        status: w.status,
        club: {
          id: w.club.id,
          name: w.club.name,
          bankInfo: w.club.account,
        },
        createdAt: w.createdAt,
        reviewedAt: w.reviewedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 检查用户是否有俱乐部管理权限
   */
  private async checkClubPermission(userId: string, clubId: string): Promise<boolean> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { ownerId: true },
    });

    if (club?.ownerId === userId) {
      return true;
    }

    const member = await this.prisma.clubMember.findFirst({
      where: {
        clubId,
        leader: { userId },
        role: { in: [ClubRole.OWNER, ClubRole.ADMIN] },
      },
    });

    return !!member;
  }
}
