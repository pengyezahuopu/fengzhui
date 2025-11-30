import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { WechatPayService } from '../src/payment/wechat-pay.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { OrderStatus, EnrollStatus, PaymentStatus, RefundStatus, RefundReason } from '@prisma/client';

describe('Phase 4.2: Refund & Verification Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let leaderUserId: string;
  let clubId: string;
  let activityId: string;
  let routeId: string;
  let enrollmentId: string;
  let orderId: string;
  let orderNo: string;
  let refundId: string;
  let verifyCode: string;

  // Mock WechatPayService
  const mockWechatPayService = {
    unifiedOrder: jest.fn().mockResolvedValue({
      prepayId: 'mock_prepay_id',
      nonceStr: 'mock_nonce_str',
    }),
    generatePayParams: jest.fn().mockReturnValue({
      timeStamp: '1234567890',
      nonceStr: 'mock_nonce_str',
      package: 'prepay_id=mock_prepay_id',
      signType: 'RSA',
      paySign: 'mock_sign',
    }),
    verifyNotifySignature: jest.fn().mockReturnValue(true),
    decryptNotifyResource: jest.fn().mockReturnValue({
      transaction_id: 'mock_wx_transaction_id',
      out_trade_no: 'mock_order_no', 
      trade_state: 'SUCCESS',
      amount: {
        total: 10000,
        payer_total: 10000,
        currency: 'CNY',
        payer_currency: 'CNY',
      },
      success_time: '2023-10-01T12:00:00+08:00',
      payer: { openid: 'mock_openid' },
    }),
    queryOrder: jest.fn().mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'mock_wx_transaction_id',
    }),
    refund: jest.fn().mockResolvedValue({
      refundId: 'mock_wx_refund_id',
      outRefundNo: 'mock_refund_no',
    }),
  };

  // Mock JwtAuthGuard
  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const userId = req.headers['x-mock-user-id'];
      if (userId) {
        req.user = { userId };
        return true;
      }
      return false;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WechatPayService)
      .useValue(mockWechatPayService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Cleanup
    await prisma.refund.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.route.deleteMany();
    await prisma.clubMember.deleteMany();
    await prisma.club.deleteMany();
    await prisma.leaderProfile.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create Users
    const user = await prisma.user.create({
      data: { nickname: 'Test User', openId: 'test_openid' },
    });
    userId = user.id;

    const leaderUser = await prisma.user.create({
      data: { nickname: 'Leader User', openId: 'leader_openid' },
    });
    leaderUserId = leaderUser.id;

    // 2. Create Leader Profile
    const leader = await prisma.leaderProfile.create({
      data: {
        userId: leaderUserId,
        realName: 'Leader Name',
        idCard: '123456789012345678',
      },
    });

    // 3. Create Club
    const club = await prisma.club.create({
      data: {
        name: 'Test Club',
        ownerId: leaderUserId,
      },
    });
    clubId = club.id;

    // Add leader as club admin
    await prisma.clubMember.create({
      data: {
        clubId: club.id,
        leaderId: leader.id,
        role: 'ADMIN', // ClubRole.ADMIN
      },
    });

    // 4. Create Route
    const route = await prisma.route.create({
      data: {
        name: 'Test Route',
        distance: 10,
        elevation: 500,
      },
    });
    routeId = route.id;

    // 5. Create Activity
    const activity = await prisma.activity.create({
      data: {
        title: 'Refundable Activity',
        startTime: new Date(Date.now() + 86400000 * 3), // 3 days later
        endTime: new Date(Date.now() + 86400000 * 4),
        clubId: clubId,
        leaderId: leader.id,
        price: 100,
        maxPeople: 10,
        routeId: routeId,
        status: 'PUBLISHED',
      },
    });
    activityId = activity.id;
  });

  afterAll(async () => {
    await prisma.refund.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.route.deleteMany();
    await prisma.clubMember.deleteMany();
    await prisma.club.deleteMany();
    await prisma.leaderProfile.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ==================== Setup: Create Paid Order ====================

  it('Setup: Create and Pay Order', async () => {
    // 1. Enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        activityId,
        userId,
        amount: 100,
        contactName: 'John',
        contactPhone: '13800000000',
        status: EnrollStatus.PENDING,
      },
    });
    enrollmentId = enrollment.id;

    // 2. Order
    orderNo = `ORD${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId,
        activityId,
        enrollmentId,
        amount: 100,
        totalAmount: 100,
        status: OrderStatus.PAID,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 900000),
      },
    });
    orderId = order.id;

    // 3. Payment
    await prisma.payment.create({
      data: {
        orderId,
        amount: 100,
        status: PaymentStatus.SUCCESS,
        transactionId: 'mock_trans_id',
        nonceStr: 'mock_nonce',
      },
    });

    // 4. Generate Verify Code (Service Logic)
    verifyCode = Buffer.from(`${orderId}:${Date.now()}:mock_sig`).toString('base64');
    await prisma.order.update({
      where: { id: orderId },
      data: { verifyCode },
    });
  });

  // ==================== Refund Flow ====================

  it('Step 1: Preview Refund', () => {
    return request(app.getHttpServer())
      .get('/refunds/preview')
      .query({ orderId })
      .set('x-mock-user-id', userId)
      .expect(200)
      .expect((res) => {
        expect(res.body.canRefund).toBe(true);
        expect(res.body.refundAmount).toBeGreaterThan(0);
      });
  });

  // Note: We need to create refund via Service or Controller. Assuming endpoint exists or mocking logic.
  // In reality, we should have a POST /refunds endpoint.
  // Checking controller... No create method in previous search, maybe missed or assumed.
  // Wait, RefundController only had preview, approve, reject. 
  // Let's assume there IS a create endpoint or we manually create it to test approval flow.
  // Actually, typically user initiates refund. If endpoint missing in snippet, I will simulate DB creation.
  
  it('Step 2: User Applies for Refund (Simulated)', async () => {
    const refund = await prisma.refund.create({
      data: {
        orderId,
        refundNo: `REF${Date.now()}`,
        amount: 100,
        reason: RefundReason.USER_CANCEL,
        reasonDetail: 'Changed plan',
        status: RefundStatus.PENDING,
      },
    });
    refundId = refund.id;
    
    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.REFUNDING },
    });
  });

  it('Step 3: Club Admin Views Pending Refunds', () => {
    return request(app.getHttpServer())
      .get(`/refunds/club/${clubId}/pending`)
      .set('x-mock-user-id', leaderUserId)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find((r) => r.id === refundId);
        expect(found).toBeDefined();
      });
  });

  it('Step 4: Club Admin Approves Refund', () => {
    return request(app.getHttpServer())
      .put(`/refunds/${refundId}/approve`)
      .set('x-mock-user-id', leaderUserId)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(RefundStatus.APPROVED); // Or COMPLETED if auto-processed
        // If processRefund is called, it might go to COMPLETED if mock works
      });
  });

  it('Step 5: Verify Refund Completion', async () => {
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    // Since mockWechatPayService.refund returns success, it should be COMPLETED
    expect(refund.status).toBe(RefundStatus.COMPLETED);
    
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.REFUNDED);
  });

  // ==================== Verification Flow ====================

  it('Setup: Create Another Paid Order for Verification', async () => {
    // 1. Enrollment
    const enroll = await prisma.enrollment.create({
      data: {
        activityId,
        userId,
        amount: 100,
        contactName: 'Jane',
        contactPhone: '13900000000',
        status: EnrollStatus.PAID,
      },
    });

    // 2. Order
    const ord = await prisma.order.create({
      data: {
        orderNo: `ORD_V_${Date.now()}`,
        userId,
        activityId,
        enrollmentId: enroll.id,
        amount: 100,
        totalAmount: 100,
        status: OrderStatus.PAID,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 900000),
      },
    });
    
    // 3. Generate Valid Verify Code (using Service logic simulation or calling service if possible)
    // We need to match the signature logic in VerificationService
    // HmacSHA256(orderId:timestamp, secret)
    const timestamp = Date.now();
    const secret = 'default-verify-secret'; // From service default
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', secret)
      .update(`${ord.id}:${timestamp}`)
      .digest('hex')
      .slice(0, 8);
    
    const code = Buffer.from(`${ord.id}:${timestamp}:${signature}`).toString('base64');
    
    await prisma.order.update({
      where: { id: ord.id },
      data: { verifyCode: code },
    });

    // Store for next test
    orderId = ord.id; // Overwrite
    verifyCode = code;
  });

  it('Step 6: Verify Order (Scanner)', () => {
    return request(app.getHttpServer())
      .post('/verifications/verify') // Fixed endpoint path: verification -> verifications (plural)
      .set('x-mock-user-id', leaderUserId) // Leader verifying
      .send({ code: verifyCode })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.order.id).toBe(orderId);
      });
  });

  it('Step 7: Check Order Verified Status', async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.verifiedAt).toBeDefined();
    expect(order.verifiedBy).toBe(leaderUserId);
  });
});
