import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { CryptoService } from '../common/crypto';

describe('AccountService', () => {
  let service: AccountService;
  let prismaService: PrismaService;
  let cryptoService: CryptoService;

  const mockClub = {
    id: 'club-1',
    name: 'Test Club',
    ownerId: 'user-1',
  };

  const mockAccount = {
    id: 'account-1',
    clubId: 'club-1',
    balance: { toNumber: () => 1000 },
    frozenBalance: { toNumber: () => 200 },
    totalIncome: { toNumber: () => 5000 },
    totalWithdraw: { toNumber: () => 3000 },
    bankName: '招商银行',
    bankAccount: '6225880123456789',
    accountName: '张三',
  };

  const mockPrismaService = {
    club: {
      findUnique: jest.fn(),
    },
    clubAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCryptoService = {
    encrypt: jest.fn((val) => `encrypted:${val}`),
    decrypt: jest.fn((val) => val.replace('encrypted:', '')),
    maskBankAccount: jest.fn((val) => {
      if (!val) return '';
      if (val.startsWith('encrypted:')) val = val.replace('encrypted:', '');
      return val.length > 8 
        ? `${val.substring(0, 4)}****${val.substring(val.length - 4)}`
        : val;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    prismaService = module.get<PrismaService>(PrismaService);
    cryptoService = module.get<CryptoService>(CryptoService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateAccount', () => {
    it('should throw NotFoundException if club does not exist', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(null);

      await expect(service.getOrCreateAccount('invalid-club')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing account', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getOrCreateAccount('club-1');

      expect(result).toEqual(mockAccount);
      expect(mockPrismaService.clubAccount.create).not.toHaveBeenCalled();
    });

    it('should create account if not exists', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue(null);
      mockPrismaService.clubAccount.create.mockResolvedValue(mockAccount);

      const result = await service.getOrCreateAccount('club-1');

      expect(result).toEqual(mockAccount);
      expect(mockPrismaService.clubAccount.create).toHaveBeenCalledWith({
        data: { clubId: 'club-1' },
      });
    });
  });

  describe('getAccountDetail', () => {
    it('should return account detail with masked bank account', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getAccountDetail('club-1');

      expect(result.balance).toBe(1000);
      expect(result.frozenBalance).toBe(200);
      expect(result.availableBalance).toBe(800);
      expect(result.hasBankAccount).toBe(true);
      expect(result.bankInfo?.bankAccount).toBe('6225****6789');
    });
  });

  describe('updateBankAccount', () => {
    it('should update bank account information', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.clubAccount.update.mockResolvedValue({
        ...mockAccount,
        bankName: '工商银行',
        bankAccount: '6222021234567890123',
        accountName: '李四',
      });

      const result = await service.updateBankAccount('club-1', {
        bankName: '工商银行',
        bankAccount: '6222021234567890123',
        accountName: '李四',
      });

      expect(result.success).toBe(true);
      expect(result.bankInfo?.bankName).toBe('工商银行');
    });
  });

  describe('freezeBalance', () => {
    it('should throw BadRequestException if insufficient available balance', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue({
        ...mockAccount,
        balance: { toNumber: () => 500 },
        frozenBalance: { toNumber: () => 400 },
      });

      await expect(service.freezeBalance('club-1', 200)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should freeze balance successfully', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.clubAccount.update.mockResolvedValue({
        ...mockAccount,
        frozenBalance: { toNumber: () => 400 },
      });

      const result = await service.freezeBalance('club-1', 200);

      expect(mockPrismaService.clubAccount.update).toHaveBeenCalled();
    });
  });

  describe('deductBalance', () => {
    it('should throw BadRequestException if insufficient balance', async () => {
      mockPrismaService.club.findUnique.mockResolvedValue(mockClub);
      mockPrismaService.clubAccount.findUnique.mockResolvedValue({
        ...mockAccount,
        balance: { toNumber: () => 300 },
        frozenBalance: { toNumber: () => 200 },
      });

      await expect(service.deductBalance('club-1', 200)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
