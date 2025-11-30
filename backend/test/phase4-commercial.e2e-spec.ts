import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { WechatPayService } from '../src/payment/wechat-pay.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { OrderStatus, EnrollStatus, PaymentStatus } from '@prisma/client';

describe('Phase 4: Commercial Flow (E2E)', () => {
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
      out_trade_no: 'mock_order_no', // Will be updated in test
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
        title: 'Paid Hiking Activity',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        clubId: clubId,
        leaderId: leader.id,
        price: 100, // 100 CNY
        maxPeople: 10,
        routeId: routeId,
        status: 'PUBLISHED',
      },
    });
    activityId = activity.id;
  });

  afterAll(async () => {
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

  it('Step 1: Create Enrollment', () => {
    return request(app.getHttpServer())
      .post('/enrollments')
      // EnrollmentController might not be guarded, or if it is, we need header
      // Assuming it's NOT guarded for creation based on previous phases or it uses mock user id too if guarded
      // Let's add the header just in case
      .set('x-mock-user-id', userId) 
      .send({
        activityId,
        userId,
        contactName: 'John Doe',
        contactPhone: '13800138000',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe(EnrollStatus.PENDING);
        enrollmentId = res.body.id;
      });
  });

  it('Step 2: Create Order', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('x-mock-user-id', userId) // Use mock header
      .send({
        enrollmentId,
        insuredName: 'John Doe',
        insuredPhone: '13800138000',
        insuredIdCard: '110101199001011234',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe(OrderStatus.PENDING);
        expect(res.body.totalAmount).toBe('100'); // Decimal returned as string
        orderId = res.body.id;
        orderNo = res.body.orderNo;
        
        // Update mock for notify
        mockWechatPayService.decryptNotifyResource.mockReturnValue({
          transaction_id: 'mock_wx_transaction_id',
          out_trade_no: orderNo, // IMPORTANT: Match the real orderNo
          trade_state: 'SUCCESS',
          amount: {
            total: 10000,
            payer_total: 10000,
            currency: 'CNY',
            payer_currency: 'CNY',
          },
          success_time: '2023-10-01T12:00:00+08:00',
          payer: { openid: 'test_openid' },
        });
      });
  });

  it('Step 3: Prepay', () => {
    return request(app.getHttpServer())
      .post('/payments/prepay')
      .set('x-mock-user-id', userId)
      .send({
        orderId,
        openId: 'test_openid',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.timeStamp).toBeDefined();
        expect(res.body.paySign).toBe('mock_sign');
        // Verify order status changed to PAYING
        return prisma.order.findUnique({ where: { id: orderId } }).then((order) => {
          expect(order.status).toBe(OrderStatus.PAYING);
          // Verify Payment record exists
          return prisma.payment.findUnique({ where: { orderId } }).then((payment) => {
             expect(payment).toBeDefined();
             expect(payment.status).toBe(PaymentStatus.PENDING);
          });
        });
      });
  });

  it('Step 4: WeChat Notify (Callback)', () => {
    // Simulate Wechat Callback
    return request(app.getHttpServer())
      .post('/payments/notify/wechat')
      .set('wechatpay-timestamp', Math.floor(Date.now() / 1000).toString())
      .set('wechatpay-nonce', 'mock_nonce')
      .set('wechatpay-signature', 'mock_signature')
      .set('wechatpay-serial', 'mock_serial')
      .send({
        id: 'evt_123',
        create_time: '2023-10-01T12:00:00+08:00',
        resource_type: 'encrypt-resource',
        event_type: 'TRANSACTION.SUCCESS',
        summary: '支付成功',
        resource: {
          algorithm: 'AEAD_AES_256_GCM',
          ciphertext: 'mock_ciphertext',
          nonce: 'mock_nonce',
          associated_data: 'mock_ad',
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.code).toBe('SUCCESS');
      });
  });

  it('Step 5: Verify Order Status', async () => {
    // Allow async processing time if any (though controller awaits service)
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.paidAt).toBeDefined();
    expect(order.verifyCode).toBeDefined();
  });

  it('Step 6: Verify Enrollment Status', async () => {
    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    expect(enrollment.status).toBe(EnrollStatus.PAID);
  });

  it('Step 7: Get Verify Code API', () => {
    return request(app.getHttpServer())
      .get(`/orders/${orderId}/verify-code`)
      .set('x-mock-user-id', userId)
      .expect(200)
      .expect((res) => {
        expect(res.body.verifyCode).toBeDefined();
      });
  });
});
