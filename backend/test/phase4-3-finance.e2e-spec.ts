import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { 
  OrderStatus, 
  EnrollStatus, 
  PaymentStatus, 
  ActivityStatus, 
  SettlementStatus, 
  WithdrawalStatus 
} from '@prisma/client';

describe('Phase 4.3: Finance & Settlement Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leaderUserId: string;
  let memberUserId: string;
  let clubId: string;
  let activityId: string;
  let routeId: string;
  let orderId: string;
  let settlementId: string;
  let withdrawalId: string;

  // Mock JwtAuthGuard
  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const userId = req.headers['x-mock-user-id'];
      if (userId) {
        req.user = { userId, id: userId }; // Some controllers use req.user.id
        return true;
      }
      return false;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Cleanup (Order matters for foreign keys)
    await prisma.transaction.deleteMany();
    await prisma.withdrawal.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.clubAccount.deleteMany();
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
    const leaderUser = await prisma.user.create({
      data: { nickname: 'Leader User', openId: 'leader_openid' },
    });
    leaderUserId = leaderUser.id;

    const memberUser = await prisma.user.create({
      data: { nickname: 'Member User', openId: 'member_openid' },
    });
    memberUserId = memberUser.id;

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
        name: 'Finance Test Club',
        ownerId: leaderUserId,
      },
    });
    clubId = club.id;

    // Add leader as club admin
    await prisma.clubMember.create({
      data: {
        clubId: club.id,
        leaderId: leader.id,
        role: 'ADMIN',
      },
    });

    // 4. Create Route
    const route = await prisma.route.create({
      data: {
        name: 'Finance Route',
        distance: 5,
        elevation: 100,
      },
    });
    routeId = route.id;

    // 5. Create Completed Activity (Simulating activity ended for settlement)
    const activity = await prisma.activity.create({
      data: {
        title: 'Completed Activity',
        startTime: new Date(Date.now() - 86400000 * 2), // 2 days ago
        endTime: new Date(Date.now() - 86400000),       // 1 day ago
        clubId: clubId,
        leaderId: leader.id,
        price: 100,
        maxPeople: 10,
        routeId: routeId,
        status: ActivityStatus.COMPLETED, // Important: Must be COMPLETED for settlement
      },
    });
    activityId = activity.id;

    // 6. Create Paid Order (Simulating income)
    const enrollment = await prisma.enrollment.create({
      data: {
        activityId,
        userId: memberUserId,
        amount: 200, // Increase to 200 to meet min withdrawal
        contactName: 'Member',
        contactPhone: '13900000000',
        status: EnrollStatus.CHECKED_IN, // User attended
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNo: `ORD_F_${Date.now()}`,
        userId: memberUserId,
        activityId,
        enrollmentId: enrollment.id,
        amount: 200,
        totalAmount: 200,
        status: OrderStatus.COMPLETED, // Order completed (verified)
        paidAt: new Date(Date.now() - 86400000 * 2),
        expiresAt: new Date(Date.now() - 86400000 * 2 + 900000), // Expired long ago but paid
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.withdrawal.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.clubAccount.deleteMany();
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

  // ==================== Settlement Flow ====================

  it('Step 1: Trigger Settlement (Admin)', async () => {
    // First call: Creates and Executes Settlement (COMPLETED)
    await request(app.getHttpServer())
      .post(`/finance/admin/settlements/activity/${activityId}`)
      .set('x-mock-user-id', leaderUserId)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    // Second call: Should fail because already completed
    return request(app.getHttpServer())
      .post(`/finance/admin/settlements/activity/${activityId}`)
      .set('x-mock-user-id', leaderUserId)
      .expect(400);
  });

  it('Step 2: Verify Settlement Record', async () => {
    const settlement = await prisma.settlement.findFirst({
      where: { activityId },
    });
    expect(settlement).toBeDefined();
    expect(settlement.status).toBe(SettlementStatus.COMPLETED);
    expect(settlement.totalAmount.toNumber()).toBe(200);
    // Platform fee 5%: 200 * 0.05 = 10
    expect(settlement.platformFee.toNumber()).toBe(10);
    // Settle amount: 190
    expect(settlement.settleAmount.toNumber()).toBe(190);
    settlementId = settlement.id;
  });

  it('Step 3: Verify Club Account Balance', async () => {
    const account = await prisma.clubAccount.findUnique({
      where: { clubId },
    });
    expect(account).toBeDefined();
    expect(account.balance.toNumber()).toBe(190);
    expect(account.totalIncome.toNumber()).toBe(190);
  });

  it('Step 4: Verify Transaction Log', async () => {
    const transactions = await prisma.transaction.findMany({
      where: { clubId },
    });
    expect(transactions.length).toBeGreaterThanOrEqual(1);
    const incomeTx = transactions.find(t => t.amount.toNumber() === 190);
    expect(incomeTx).toBeDefined();
  });

  // ==================== Withdrawal Flow ====================

  it('Step 5: Set Bank Account', () => {
    return request(app.getHttpServer())
      .put(`/finance/clubs/${clubId}/account/bank`)
      .set('x-mock-user-id', leaderUserId)
      .send({
        bankName: 'ICBC',
        bankAccount: '6222021234567890',
        accountName: 'Leader Real Name',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.bankInfo.bankName).toBe('ICBC');
      });
  });

  it('Step 6: Apply for Withdrawal', () => {
    return request(app.getHttpServer())
      .post(`/finance/clubs/${clubId}/withdrawals`)
      .set('x-mock-user-id', leaderUserId)
      .send({
        amount: 100, // Withdraw 100 (>= 100 min)
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(WithdrawalStatus.PENDING);
        expect(res.body.amount).toBe(100);
        withdrawalId = res.body.id;
      });
  });

  it('Step 7: Verify Balance Frozen', async () => {
    const account = await prisma.clubAccount.findUnique({
      where: { clubId },
    });
    // Balance should be 190 (Frozen is part of balance)
    expect(account.balance.toNumber()).toBe(190);
    // Frozen should be 100
    expect(account.frozenBalance.toNumber()).toBe(100);
  });

  it('Step 7.5: Admin Approve Withdrawal', () => {
    return request(app.getHttpServer())
      .post(`/finance/admin/withdrawals/${withdrawalId}/approve`)
      .set('x-mock-user-id', leaderUserId) // Admin
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe(WithdrawalStatus.APPROVED);
      });
  });

  it('Step 8: Admin Complete Withdrawal', async () => {
    await request(app.getHttpServer())
      .post(`/finance/admin/withdrawals/${withdrawalId}/complete`)
      .set('x-mock-user-id', leaderUserId) // Admin
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    expect(withdrawal.status).toBe(WithdrawalStatus.COMPLETED);
  });

  it('Step 9: Verify Final Balance', async () => {
    const account = await prisma.clubAccount.findUnique({
      where: { clubId },
    });
    // Frozen should be released (deducted) -> 0
    expect(account.frozenBalance.toNumber()).toBe(0);
    // Balance remains 90
    expect(account.balance.toNumber()).toBe(90);
    // Total Withdraw increased
    expect(account.totalWithdraw.toNumber()).toBe(100);
  });
});
