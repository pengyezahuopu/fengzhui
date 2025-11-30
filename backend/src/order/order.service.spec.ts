import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus, EnrollStatus, InsuranceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: PrismaService;

  const mockPrismaService = {
    enrollment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    insurance: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const userId = 'user-1';
    const enrollmentId = 'enrollment-1';
    const dto = {
      enrollmentId,
      insuredName: '张三',
      insuredPhone: '13800138000',
    };

    const mockEnrollment = {
      id: enrollmentId,
      userId,
      status: EnrollStatus.PENDING,
      amount: new Decimal('299.00'),
      activity: {
        id: 'activity-1',
        title: '周末徒步',
        startTime: new Date('2025-12-10'),
        endTime: new Date('2025-12-11'),
        insuranceProduct: {
          id: 'insurance-product-1',
          price: new Decimal('5.00'),
        },
        refundPolicy: null,
        club: { id: 'club-1', name: '登山俱乐部' },
      },
      order: null,
    };

    it('should create order successfully', async () => {
      mockPrismaService.enrollment.findUnique.mockResolvedValue(mockEnrollment);
      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-1',
        orderNo: '20251201000001ABC123',
        userId,
        activityId: 'activity-1',
        enrollmentId,
        amount: new Decimal('299.00'),
        insuranceFee: new Decimal('5.00'),
        totalAmount: new Decimal('304.00'),
        status: OrderStatus.PENDING,
        expiresAt: new Date(),
        activity: mockEnrollment.activity,
        enrollment: mockEnrollment,
      });

      const result = await service.createOrder(userId, dto);

      expect(result).toBeDefined();
      expect(result.orderNo).toBeDefined();
      expect(mockPrismaService.enrollment.findUnique).toHaveBeenCalledWith({
        where: { id: enrollmentId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.order.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when enrollment not found', async () => {
      mockPrismaService.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own enrollment', async () => {
      mockPrismaService.enrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        userId: 'other-user',
      });

      await expect(service.createOrder(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when enrollment status is not PENDING', async () => {
      mockPrismaService.enrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollStatus.PAID,
      });

      await expect(service.createOrder(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing valid order if one exists', async () => {
      const existingOrder = {
        id: 'existing-order-1',
        status: OrderStatus.PENDING,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      };

      mockPrismaService.enrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        order: existingOrder,
      });

      const result = await service.createOrder(userId, dto);

      expect(result).toEqual(existingOrder);
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    const userId = 'user-1';
    const orderId = 'order-1';

    const mockOrder = {
      id: orderId,
      userId,
      orderNo: '20251201000001ABC123',
      status: OrderStatus.PENDING,
      activity: {
        id: 'activity-1',
        title: '周末徒步',
        club: { id: 'club-1', name: '登山俱乐部', logo: null },
      },
      enrollment: {},
      payment: null,
      refund: null,
      insurance: null,
    };

    it('should return order details', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(userId, orderId);

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById(userId, orderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'other-user',
      });

      await expect(service.getOrderById(userId, orderId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getOrders', () => {
    const userId = 'user-1';

    it('should return paginated orders', async () => {
      const mockOrders = [
        { id: 'order-1', orderNo: '001', status: OrderStatus.PENDING },
        { id: 'order-2', orderNo: '002', status: OrderStatus.PAID },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(2);

      const result = await service.getOrders(userId, { page: 1, limit: 10 });

      expect(result.items).toEqual(mockOrders);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.getOrders(userId, { status: OrderStatus.PAID });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: OrderStatus.PAID },
        }),
      );
    });
  });

  describe('cancelOrder', () => {
    const userId = 'user-1';
    const orderId = 'order-1';

    const mockOrder = {
      id: orderId,
      userId,
      enrollmentId: 'enrollment-1',
      status: OrderStatus.PENDING,
    };

    it('should cancel order successfully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      const result = await service.cancelOrder(userId, orderId);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrder(userId, orderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'other-user',
      });

      await expect(service.cancelOrder(userId, orderId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when order is not PENDING', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      await expect(service.cancelOrder(userId, orderId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getVerifyCode', () => {
    const userId = 'user-1';
    const orderId = 'order-1';

    it('should return existing verify code', async () => {
      const existingCode = 'existing-verify-code';
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PAID,
        verifyCode: existingCode,
      });

      const result = await service.getVerifyCode(userId, orderId);

      expect(result.verifyCode).toBe(existingCode);
    });

    it('should generate new verify code if not exists', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PAID,
        verifyCode: null,
      });
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.getVerifyCode(userId, orderId);

      expect(result.verifyCode).toBeDefined();
      expect(mockPrismaService.order.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when order is not PAID', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
        verifyCode: null,
      });

      await expect(service.getVerifyCode(userId, orderId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateVerifyCode', () => {
    it('should validate correct verify code', () => {
      const orderId = 'test-order-id';
      const code = service.generateVerifyCode(orderId);

      const result = service.validateVerifyCode(code);

      expect(result.valid).toBe(true);
      expect(result.orderId).toBe(orderId);
    });

    it('should reject invalid verify code', () => {
      const result = service.validateVerifyCode('invalid-code');

      expect(result.valid).toBe(false);
    });

    it('should reject tampered verify code', () => {
      const orderId = 'test-order-id';
      const code = service.generateVerifyCode(orderId);
      const tamperedCode = code.slice(0, -1) + 'x'; // Tamper with last character

      const result = service.validateVerifyCode(tamperedCode);

      expect(result.valid).toBe(false);
    });
  });

  describe('cancelExpiredOrders', () => {
    it('should cancel expired orders', async () => {
      const expiredOrders = [
        { id: 'order-1', enrollmentId: 'enrollment-1' },
        { id: 'order-2', enrollmentId: 'enrollment-2' },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(expiredOrders);

      const result = await service.cancelExpiredOrders();

      expect(result.cancelledCount).toBe(2);
    });

    it('should return 0 when no expired orders', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await service.cancelExpiredOrders();

      expect(result.cancelledCount).toBe(0);
    });
  });
});
