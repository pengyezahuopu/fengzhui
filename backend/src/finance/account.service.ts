import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateBankAccountDto } from './dto';
import { Prisma } from '@prisma/client';
import { CryptoService } from '../common/crypto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * 获取或创建俱乐部账户
   */
  async getOrCreateAccount(clubId: string) {
    // 先验证俱乐部存在
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw new NotFoundException('俱乐部不存在');
    }

    // 获取或创建账户
    let account = await this.prisma.clubAccount.findUnique({
      where: { clubId },
    });

    if (!account) {
      account = await this.prisma.clubAccount.create({
        data: { clubId },
      });
      this.logger.log(`Created account for club: ${clubId}`);
    }

    return account;
  }

  /**
   * 获取账户详情
   */
  async getAccountDetail(clubId: string) {
    const account = await this.getOrCreateAccount(clubId);

    return {
      id: account.id,
      clubId: account.clubId,
      balance: account.balance.toNumber(),
      frozenBalance: account.frozenBalance.toNumber(),
      totalIncome: account.totalIncome.toNumber(),
      totalWithdraw: account.totalWithdraw.toNumber(),
      availableBalance: account.balance.toNumber() - account.frozenBalance.toNumber(),
      hasBankAccount: !!(account.bankName && account.bankAccount),
      bankInfo: account.bankName ? {
        bankName: account.bankName,
        // 使用加密服务进行脱敏显示（支持加密和明文数据）
        bankAccount: this.cryptoService.maskBankAccount(account.bankAccount || ''),
        accountName: account.accountName,
      } : null,
    };
  }

  /**
   * 更新银行账户信息
   * 银行账号使用 AES-256-GCM 加密存储
   */
  async updateBankAccount(clubId: string, dto: UpdateBankAccountDto) {
    const account = await this.getOrCreateAccount(clubId);

    // 加密银行账号
    const encryptedBankAccount = dto.bankAccount
      ? this.cryptoService.encrypt(dto.bankAccount)
      : null;

    const updated = await this.prisma.clubAccount.update({
      where: { id: account.id },
      data: {
        bankName: dto.bankName,
        bankAccount: encryptedBankAccount,
        accountName: dto.accountName,
      },
    });

    this.logger.log(`Bank account updated for club: ${clubId}`);

    return {
      success: true,
      bankInfo: {
        bankName: updated.bankName,
        // 返回脱敏后的账号（从加密数据中解密后脱敏）
        bankAccount: this.cryptoService.maskBankAccount(updated.bankAccount || ''),
        accountName: updated.accountName,
      },
    };
  }

  /**
   * 增加余额 (内部使用)
   */
  async addBalance(
    clubId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;
    const account = await this.getOrCreateAccount(clubId);

    const updated = await prismaClient.clubAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: new Prisma.Decimal(amount) },
        totalIncome: { increment: new Prisma.Decimal(amount) },
      },
    });

    this.logger.log(`Balance increased for club ${clubId}: +${amount}`);
    return updated;
  }

  /**
   * 扣减余额 (内部使用)
   */
  async deductBalance(
    clubId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;
    const account = await this.getOrCreateAccount(clubId);

    const availableBalance = account.balance.toNumber() - account.frozenBalance.toNumber();
    if (availableBalance < amount) {
      throw new BadRequestException('余额不足');
    }

    const updated = await prismaClient.clubAccount.update({
      where: { id: account.id },
      data: {
        balance: { decrement: new Prisma.Decimal(amount) },
      },
    });

    this.logger.log(`Balance decreased for club ${clubId}: -${amount}`);
    return updated;
  }

  /**
   * 冻结余额 (提现申请时)
   */
  async freezeBalance(
    clubId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;
    const account = await this.getOrCreateAccount(clubId);

    const availableBalance = account.balance.toNumber() - account.frozenBalance.toNumber();
    if (availableBalance < amount) {
      throw new BadRequestException('可用余额不足');
    }

    const updated = await prismaClient.clubAccount.update({
      where: { id: account.id },
      data: {
        frozenBalance: { increment: new Prisma.Decimal(amount) },
      },
    });

    this.logger.log(`Balance frozen for club ${clubId}: ${amount}`);
    return updated;
  }

  /**
   * 解冻余额 (提现失败/取消时)
   */
  async unfreezeBalance(
    clubId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;
    const account = await this.getOrCreateAccount(clubId);

    const updated = await prismaClient.clubAccount.update({
      where: { id: account.id },
      data: {
        frozenBalance: { decrement: new Prisma.Decimal(amount) },
      },
    });

    this.logger.log(`Balance unfrozen for club ${clubId}: ${amount}`);
    return updated;
  }

  /**
   * 完成提现 (扣除冻结金额，增加累计提现)
   */
  async completeWithdrawal(
    clubId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prismaClient = tx || this.prisma;
    const account = await this.getOrCreateAccount(clubId);

    const updated = await prismaClient.clubAccount.update({
      where: { id: account.id },
      data: {
        balance: { decrement: new Prisma.Decimal(amount) },
        frozenBalance: { decrement: new Prisma.Decimal(amount) },
        totalWithdraw: { increment: new Prisma.Decimal(amount) },
      },
    });

    this.logger.log(`Withdrawal completed for club ${clubId}: ${amount}`);
    return updated;
  }

}
