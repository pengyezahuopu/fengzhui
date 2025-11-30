import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, EnrollStatus, ClubRole, Role } from '@prisma/client';
import * as crypto from 'crypto';

describe('VerificationService', () => {
  let service: VerificationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    activity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    enrollment: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    clubMember: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  // Helper to generate valid verify code
  const generateTestVerifyCode = (orderId: string): string => {
    const timestamp = Date.now();
    const data = `${orderId}:${timestamp}`;
    const secret = process.env.VERIFY_SECRET || 'default-verify-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')
      .slice(0, 8);
    return Buffer.from(`${orderId}:${timestamp}:${signature}`).toString('base64');
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('verifyOrder', () => {
    const mockOrder = {
      id: 'order-1',
      orderNo: '202501010001',
      userId: 'user-1',
      activityId: 'activity-1',
      enrollmentId: 'enrollment-1',
      status: OrderStatus.PAID,
      verifyCode: null as string | null,
      verifiedAt: null,
      verifiedBy: null,
      activity: {
        id: 'activity-1',
        title: '徒步活动',
        startTime: new Date(),
        endTime: new Date(),
      },
      user: {
        id: 'user-1',
        nickname: '测试用户',
        phone: '13800138000',
      },
      enrollment: {
        contactName: '张三',
        contactPhone: '13800138000',
      },
    };

    const mockActivity = {
      id: 'activity-1',
      leader: { userId: 'leader-1' },
      club: {
        id: 'club-1',
        members: [
          { role: ClubRole.LEADER, leader: { userId: 'leader-1' } },
        ],
      },
    };

    it('should verify order successfully', async () => {
      const verifyCode = generateTestVerifyCode('order-1');
      mockOrder.verifyCode = verifyCode;

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        verifiedAt: new Date(),
        verifiedBy: 'leader-1',
      });

      const result = await service.verifyOrder('leader-1', verifyCode);

      expect(result.success).toBe(true);
      expect(result.order.orderNo).toBe('202501010001');
    });

    it('should throw BadRequestException for invalid verify code', async () => {
      await expect(
        service.verifyOrder('leader-1', 'invalid-code'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      const verifyCode = generateTestVerifyCode('non-existent-order');
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.verifyOrder('leader-1', verifyCode)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user has no permission', async () => {
      const verifyCode = generateTestVerifyCode('order-1');
      mockOrder.verifyCode = verifyCode;

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.activity.findUnique.mockResolvedValue({
        ...mockActivity,
        leader: { userId: 'other-leader' },
        club: { id: 'club-1', members: [] },
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ role: Role.USER });

      await expect(
        service.verifyOrder('unauthorized-user', verifyCode),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order is not paid', async () => {
      const verifyCode = generateTestVerifyCode('order-1');
      mockOrder.verifyCode = verifyCode;

      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PENDING,
      });
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);

      await expect(service.verifyOrder('leader-1', verifyCode)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if already verified', async () => {
      const verifyCode = generateTestVerifyCode('order-1');
      mockOrder.verifyCode = verifyCode;

      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        verifiedAt: new Date(),
      });
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);

      await expect(service.verifyOrder('leader-1', verifyCode)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getActivityVerificationStats', () => {
    const mockActivity = {
      id: 'activity-1',
      title: '徒步活动',
      startTime: new Date(),
      maxPeople: 20,
      leader: { userId: 'leader-1' },
      club: {
        id: 'club-1',
        members: [{ role: ClubRole.LEADER, leader: { userId: 'leader-1' } }],
      },
    };

    it('should return verification stats', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.order.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(6)  // verified
        .mockResolvedValueOnce(4); // pending

      const result = await service.getActivityVerificationStats('leader-1', 'activity-1');

      expect(result.stats.total).toBe(10);
      expect(result.stats.verified).toBe(6);
      expect(result.stats.pending).toBe(4);
      expect(result.stats.verifiedRate).toBe(60);
    });

    it('should throw ForbiddenException if no permission', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue({
        ...mockActivity,
        leader: { userId: 'other-leader' },
        club: { id: 'club-1', members: [] },
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ role: Role.USER });

      await expect(
        service.getActivityVerificationStats('unauthorized-user', 'activity-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getActivityVerifications', () => {
    const mockActivity = {
      id: 'activity-1',
      leader: { userId: 'leader-1' },
      club: {
        id: 'club-1',
        members: [{ role: ClubRole.LEADER, leader: { userId: 'leader-1' } }],
      },
    };

    const mockOrders = [
      {
        id: 'order-1',
        orderNo: '202501010001',
        paidAt: new Date(),
        verifiedAt: null,
        verifiedBy: null,
        user: { id: 'user-1', nickname: '用户1', avatarUrl: null, phone: '13800138001' },
        enrollment: { contactName: '张三', contactPhone: '13800138001' },
      },
      {
        id: 'order-2',
        orderNo: '202501010002',
        paidAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: 'leader-1',
        user: { id: 'user-2', nickname: '用户2', avatarUrl: null, phone: '13800138002' },
        enrollment: { contactName: '李四', contactPhone: '13800138002' },
      },
    ];

    it('should return all verifications', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getActivityVerifications('leader-1', 'activity-1', 'all');

      expect(result).toHaveLength(2);
    });

    it('should filter pending verifications', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.order.findMany.mockResolvedValue([mockOrders[0]]);

      const result = await service.getActivityVerifications('leader-1', 'activity-1', 'pending');

      expect(result).toHaveLength(1);
      expect(result[0].verifiedAt).toBeNull();
    });

    it('should filter verified verifications', async () => {
      mockPrismaService.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrismaService.order.findMany.mockResolvedValue([mockOrders[1]]);

      const result = await service.getActivityVerifications('leader-1', 'activity-1', 'verified');

      expect(result).toHaveLength(1);
      expect(result[0].verifiedAt).not.toBeNull();
    });
  });

  describe('getPendingVerificationActivities', () => {
    it('should return pending activities for leader', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: '徒步活动',
          startTime: new Date(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          _count: { orders: 5 },
          club: { id: 'club-1', name: '户外俱乐部' },
        },
      ];

      mockPrismaService.activity.findMany.mockResolvedValue(mockActivities);
      mockPrismaService.clubMember.findMany.mockResolvedValue([]);

      const result = await service.getPendingVerificationActivities('leader-1');

      expect(result).toHaveLength(1);
      expect(result[0].pendingCount).toBe(5);
      expect(result[0].role).toBe('leader');
    });
  });

  describe('verifyByOrderNo', () => {
    it('should verify order by order number', async () => {
      const verifyCode = generateTestVerifyCode('order-1');

      mockPrismaService.order.findUnique
        .mockResolvedValueOnce({
          id: 'order-1',
          verifyCode,
          activityId: 'activity-1',
          status: OrderStatus.PAID,
          verifiedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'order-1',
          orderNo: '202501010001',
          activityId: 'activity-1',
          status: OrderStatus.PAID,
          verifyCode,
          verifiedAt: null,
          verifiedBy: null,
          activity: { id: 'activity-1', title: '活动', startTime: new Date(), endTime: new Date() },
          user: { id: 'user-1', nickname: '用户', phone: '13800138000' },
          enrollment: { contactName: '张三', contactPhone: '13800138000' },
        });

      mockPrismaService.activity.findUnique.mockResolvedValue({
        id: 'activity-1',
        leader: { userId: 'leader-1' },
        club: { id: 'club-1', members: [] },
      });

      mockPrismaService.order.update.mockResolvedValue({
        id: 'order-1',
        orderNo: '202501010001',
        verifiedAt: new Date(),
        verifiedBy: 'leader-1',
        activity: { id: 'activity-1', title: '活动', startTime: new Date() },
        user: { id: 'user-1', nickname: '用户' },
        enrollment: { contactName: '张三' },
      });

      const result = await service.verifyByOrderNo('leader-1', '202501010001');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyByOrderNo('leader-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no verify code', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        verifyCode: null,
        activityId: 'activity-1',
        status: OrderStatus.PAID,
      });

      await expect(
        service.verifyByOrderNo('leader-1', '202501010001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
