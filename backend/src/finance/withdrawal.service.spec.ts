import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalService } from './withdrawal.service';
import { PrismaService } from '../prisma.service';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalStatus } from '@prisma/client';

describe('WithdrawalService', () => {
  let service: WithdrawalService;
  let prismaService: PrismaService;
  let accountService: AccountService;

  const mockAccount = {
    id: 'account-1',
    clubId: 'club-1',
    balance: { toNumber: () => 1000 },
    frozenBalance: { toNumber: () => 0 },
    bankName: '招商银行',
    bankAccount: '6225880123456789',
    accountName: '张三',
  };

  const mockWithdrawal = {
    id: 'wd-1',
    withdrawalNo: 'WD20251130123456ABC',
    clubId: 'club-1',
    amount: { toNumber: () => 500 },
    fee: { toNumber: () => 0 },
    actualAmount: { toNumber: () => 500 },
    status: WithdrawalStatus.PENDING,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    club: {
      findUnique: jest.fn(),
    },
    clubMember: {
      findFirst: jest.fn(),
    },
    withdrawal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAccountService = {
    getOrCreateAccount: jest.fn(),
    freezeBalance: jest.fn(),
    unfreezeBalance: jest.fn(),
    completeWithdrawal: jest.fn(),
  };

  const mockTransactionService = {
    createTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    }).compile();

    service = module.get<WithdrawalService>(WithdrawalService);
    prismaService = module.get<PrismaService>(PrismaService);
    accountService = module.get<AccountService>(AccountService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWithdrawal', () => {
    it('should throw ForbiddenException if user has no permission', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(null);
      mockPrismaService.clubMember.findFirst.mockResolvedValue(null);

      await expect(
        service.createWithdrawal('user-1', 'club-1', { amount: 500 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if bank account not set', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      mockAccountService.getOrCreateAccount.mockResolvedValue({
        ...mockAccount,
        bankName: null,
        bankAccount: null,
      });

      await expect(
        service.createWithdrawal('user-1', 'club-1', { amount: 500 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if insufficient balance', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      mockAccountService.getOrCreateAccount.mockResolvedValue({
        ...mockAccount,
        balance: { toNumber: () => 300 },
        frozenBalance: { toNumber: () => 0 },
      });

      await expect(
        service.createWithdrawal('user-1', 'club-1', { amount: 500 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if amount below minimum', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue({ ownerId: 'user-1' });
      mockAccountService.getOrCreateAccount.mockResolvedValue(mockAccount);

      await expect(
        service.createWithdrawal('user-1', 'club-1', { amount: 50 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveWithdrawal', () => {
    it('should throw NotFoundException if withdrawal not found', async () => {
      mockPrismaService.withdrawal.findUnique.mockResolvedValue(null);

      await expect(
        service.approveWithdrawal('admin-1', 'invalid-wd'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal already processed', async () => {
      mockPrismaService.withdrawal.findUnique.mockResolvedValue({
        ...mockWithdrawal,
        status: WithdrawalStatus.COMPLETED,
      });

      await expect(
        service.approveWithdrawal('admin-1', 'wd-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve withdrawal successfully', async () => {
      mockPrismaService.withdrawal.findUnique.mockResolvedValue(mockWithdrawal);
      mockPrismaService.withdrawal.update.mockResolvedValue({
        ...mockWithdrawal,
        status: WithdrawalStatus.APPROVED,
      });

      const result = await service.approveWithdrawal('admin-1', 'wd-1');

      expect(result.status).toBe(WithdrawalStatus.APPROVED);
      expect(mockPrismaService.withdrawal.update).toHaveBeenCalled();
    });
  });

  describe('getWithdrawals', () => {
    it('should return paginated withdrawals', async () => {
      mockPrismaService.withdrawal.findMany.mockResolvedValue([mockWithdrawal]);
      mockPrismaService.withdrawal.count.mockResolvedValue(1);

      const result = await service.getWithdrawals('club-1', { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
