import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { PrismaService } from '../prisma.service';
import { WechatPayService } from '../payment/wechat-pay.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, RefundStatus, RefundReason, ClubRole } from '@prisma/client';

describe('RefundService', () => {
  let service: RefundService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    enrollment: {
      update: jest.fn(),
    },
    clubMember: {
      findFirst: jest.fn(),
    },
    refundPolicy: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockWechatPayService = {
    refund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WechatPayService, useValue: mockWechatPayService },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('previewRefund', () => {
    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.previewRefund('user-1', 'order-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not order owner', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'other-user',
        status: OrderStatus.PAID,
      });

      await expect(service.previewRefund('user-1', 'order-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if order is not paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        refund: null,
      });

      await expect(service.previewRefund('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if refund already exists', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PAID,
        refund: { id: 'refund-1', status: RefundStatus.PENDING },
      });

      await expect(service.previewRefund('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRefundById', () => {
    it('should throw NotFoundException if refund not found', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue(null);

      await expect(service.getRefundById('user-1', 'refund-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not refund owner', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        order: { userId: 'other-user' },
      });

      await expect(service.getRefundById('user-1', 'refund-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return refund if user is owner', async () => {
      const mockRefund = {
        id: 'refund-1',
        orderId: 'order-1',
        order: { userId: 'user-1' },
      };
      mockPrismaService.refund.findUnique.mockResolvedValue(mockRefund);

      const result = await service.getRefundById('user-1', 'refund-1');

      expect(result.id).toBe('refund-1');
    });
  });

  describe('getUserRefunds', () => {
    it('should return user refunds with pagination', async () => {
      const mockRefunds = [
        { id: 'refund-1', orderId: 'order-1' },
        { id: 'refund-2', orderId: 'order-2' },
      ];

      mockPrismaService.refund.findMany.mockResolvedValue(mockRefunds);
      mockPrismaService.refund.count.mockResolvedValue(2);

      const result = await service.getUserRefunds('user-1', { page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.refund.findMany.mockResolvedValue([]);
      mockPrismaService.refund.count.mockResolvedValue(0);

      await service.getUserRefunds('user-1', { status: RefundStatus.PENDING });

      expect(mockPrismaService.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: RefundStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('getClubPendingRefunds', () => {
    it('should return pending refunds for club', async () => {
      const mockRefunds = [
        { id: 'refund-1', status: RefundStatus.PENDING },
        { id: 'refund-2', status: RefundStatus.PENDING },
      ];

      mockPrismaService.refund.findMany.mockResolvedValue(mockRefunds);

      const result = await service.getClubPendingRefunds('club-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: RefundStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('approveRefund', () => {
    it('should throw NotFoundException if refund not found', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue(null);

      await expect(service.approveRefund('admin-1', 'refund-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if refund is not pending', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        status: RefundStatus.APPROVED,
        order: { activity: { clubId: 'club-1' } },
      });
      mockPrismaService.clubMember.findFirst.mockResolvedValue({
        role: ClubRole.ADMIN,
        leader: { userId: 'admin-1' },
      });

      await expect(service.approveRefund('admin-1', 'refund-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rejectRefund', () => {
    it('should throw NotFoundException if refund not found', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectRefund('admin-1', 'refund-1', '不符合退款条件'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if refund is not pending', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        status: RefundStatus.REJECTED,
        order: { activity: { clubId: 'club-1' } },
      });
      mockPrismaService.clubMember.findFirst.mockResolvedValue({
        role: ClubRole.ADMIN,
        leader: { userId: 'admin-1' },
      });

      await expect(
        service.rejectRefund('admin-1', 'refund-1', '不符合退款条件'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
