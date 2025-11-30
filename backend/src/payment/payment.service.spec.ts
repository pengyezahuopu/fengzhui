import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { WechatPayService } from './wechat-pay.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DistributedLockService } from '../common/redis';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;
  let orderService: OrderService;
  let wechatPayService: WechatPayService;
  let lockService: DistributedLockService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockOrderService = {
    handlePaymentSuccess: jest.fn(),
  };

  const mockWechatPayService = {
    unifiedOrder: jest.fn(),
    generatePayParams: jest.fn(),
    verifyNotifySignature: jest.fn(),
    decryptNotifyResource: jest.fn(),
    queryOrder: jest.fn(),
  };

  const mockDistributedLockService = {
    tryWithLock: jest.fn((key, fn) => fn()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: WechatPayService,
          useValue: mockWechatPayService,
        },
        {
          provide: DistributedLockService,
          useValue: mockDistributedLockService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get<PrismaService>(PrismaService);
    orderService = module.get<OrderService>(OrderService);
    wechatPayService = module.get<WechatPayService>(WechatPayService);
    lockService = module.get<DistributedLockService>(DistributedLockService);

    jest.clearAllMocks();
  });

  describe('prepay', () => {
    const userId = 'user-1';
    const dto = {
      orderId: 'order-1',
      openId: 'openid-123',
    };

    const mockOrder = {
      id: 'order-1',
      orderNo: '20251201000001ABC123',
      userId,
      totalAmount: new Decimal('299.00'),
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      activity: {
        id: 'activity-1',
        title: '周末徒步',
      },
      payment: null,
    };

    it('should create prepay successfully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockWechatPayService.unifiedOrder.mockResolvedValue({
        prepayId: 'prepay_id_123',
        nonceStr: 'nonce_str_123',
      });
      mockWechatPayService.generatePayParams.mockReturnValue({
        appId: 'wx123',
        timeStamp: '1234567890',
        nonceStr: 'nonce_str_123',
        package: 'prepay_id=prepay_id_123',
        signType: 'RSA',
        paySign: 'signature',
      });
      mockPrismaService.payment.upsert.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.prepay(userId, dto);

      expect(result.appId).toBeDefined();
      expect(result.timeStamp).toBeDefined();
      expect(result.nonceStr).toBeDefined();
      expect(result.package).toContain('prepay_id=');
      expect(result.signType).toBe('RSA');
      expect(result.paySign).toBeDefined();
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.prepay(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user does not own order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'other-user',
      });

      await expect(service.prepay(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when order is not PENDING', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      await expect(service.prepay(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when order is expired', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await expect(service.prepay(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when order already paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        payment: { status: PaymentStatus.SUCCESS },
      });

      await expect(service.prepay(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWechatNotify', () => {
    const notification = {
      id: 'notify-1',
      create_time: '2025-01-01T00:00:00Z',
      resource_type: 'encrypt-resource',
      event_type: 'TRANSACTION.SUCCESS',
      resource: {
        original_type: 'transaction',
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext: 'encrypted_data',
        associated_data: 'transaction',
        nonce: 'nonce123',
      },
    };

    const headers = {
      timestamp: '1234567890',
      nonce: 'nonce123',
      signature: 'signature',
      serial: 'serial123',
    };

    const rawBody = JSON.stringify(notification);

    const mockDecryptedResult = {
      mchid: 'mch_id',
      appid: 'wx123',
      out_trade_no: '20251201000001ABC123',
      transaction_id: 'wx_transaction_123',
      trade_type: 'JSAPI',
      trade_state: 'SUCCESS',
      trade_state_desc: '支付成功',
      bank_type: 'BANK',
      success_time: '2025-01-01T00:00:00Z',
      payer: { openid: 'openid-123' },
      amount: {
        total: 29900,
        payer_total: 29900,
        currency: 'CNY',
        payer_currency: 'CNY',
      },
    };

    it('should handle payment success notification', async () => {
      mockWechatPayService.verifyNotifySignature.mockReturnValue(true);
      mockWechatPayService.decryptNotifyResource.mockReturnValue(
        mockDecryptedResult,
      );
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNo: '20251201000001ABC123',
        status: OrderStatus.PAYING,
        payment: { id: 'payment-1' },
      });
      mockPrismaService.payment.update.mockResolvedValue({});
      mockOrderService.handlePaymentSuccess.mockResolvedValue({
        success: true,
      });

      const result = await service.handleWechatNotify(
        notification,
        headers,
        rawBody,
      );

      expect(result.code).toBe('SUCCESS');
      expect(result.message).toBe('处理成功');
      expect(mockOrderService.handlePaymentSuccess).toHaveBeenCalled();
    });

    it('should throw BadRequestException when signature invalid', async () => {
      mockWechatPayService.verifyNotifySignature.mockReturnValue(false);

      await expect(
        service.handleWechatNotify(notification, headers, rawBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return success when order not found (prevent retry)', async () => {
      mockWechatPayService.verifyNotifySignature.mockReturnValue(true);
      mockWechatPayService.decryptNotifyResource.mockReturnValue(
        mockDecryptedResult,
      );
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      const result = await service.handleWechatNotify(
        notification,
        headers,
        rawBody,
      );

      expect(result.code).toBe('SUCCESS');
    });

    it('should return success when order already paid (idempotent)', async () => {
      mockWechatPayService.verifyNotifySignature.mockReturnValue(true);
      mockWechatPayService.decryptNotifyResource.mockReturnValue(
        mockDecryptedResult,
      );
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNo: '20251201000001ABC123',
        status: OrderStatus.PAID, // Already paid
      });

      const result = await service.handleWechatNotify(
        notification,
        headers,
        rawBody,
      );

      expect(result.code).toBe('SUCCESS');
      expect(mockOrderService.handlePaymentSuccess).not.toHaveBeenCalled();
    });

    it('should handle payment failure notification', async () => {
      mockWechatPayService.verifyNotifySignature.mockReturnValue(true);
      mockWechatPayService.decryptNotifyResource.mockReturnValue({
        ...mockDecryptedResult,
        trade_state: 'PAYERROR',
        trade_state_desc: '支付失败',
      });
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNo: '20251201000001ABC123',
        status: OrderStatus.PAYING,
      });
      mockPrismaService.payment.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.handleWechatNotify(
        notification,
        headers,
        rawBody,
      );

      expect(result.code).toBe('SUCCESS');
      expect(mockOrderService.handlePaymentSuccess).not.toHaveBeenCalled();
    });
  });

  describe('syncPaymentStatus', () => {
    const orderId = 'order-1';

    const mockOrder = {
      id: orderId,
      orderNo: '20251201000001ABC123',
      status: OrderStatus.PAYING,
      payment: { id: 'payment-1' },
    };

    it('should return paid status if order already paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      const result = await service.syncPaymentStatus(orderId);

      expect(result.status).toBe('paid');
      expect(result.needUpdate).toBe(false);
    });

    it('should return unknown if query returns null', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockWechatPayService.queryOrder.mockResolvedValue(null);

      const result = await service.syncPaymentStatus(orderId);

      expect(result.status).toBe('unknown');
      expect(result.needUpdate).toBe(false);
    });

    it('should update order if payment succeeded', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockWechatPayService.queryOrder.mockResolvedValue({
        trade_state: 'SUCCESS',
        transaction_id: 'wx_transaction_123',
      });
      mockPrismaService.payment.update.mockResolvedValue({});
      mockOrderService.handlePaymentSuccess.mockResolvedValue({});

      const result = await service.syncPaymentStatus(orderId);

      expect(result.status).toBe('paid');
      expect(result.needUpdate).toBe(true);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.syncPaymentStatus(orderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPaymentDetail', () => {
    const userId = 'user-1';
    const orderId = 'order-1';

    const mockOrder = {
      id: orderId,
      orderNo: '20251201000001ABC123',
      userId,
      totalAmount: new Decimal('299.00'),
      status: OrderStatus.PAID,
      payment: {
        id: 'payment-1',
        status: PaymentStatus.SUCCESS,
      },
      activity: {
        id: 'activity-1',
        title: '周末徒步',
        startTime: new Date(),
      },
    };

    it('should return payment detail', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getPaymentDetail(userId, orderId);

      expect(result.orderId).toBe(orderId);
      expect(result.orderNo).toBe(mockOrder.orderNo);
      expect(result.status).toBe(OrderStatus.PAID);
      expect(result.payment).toBeDefined();
      expect(result.activity).toBeDefined();
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentDetail(userId, orderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user does not own order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 'other-user',
      });

      await expect(service.getPaymentDetail(userId, orderId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
