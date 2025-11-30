import {
  PrismaClient,
  ActivityStatus,
  EnrollStatus,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  InsuranceStatus,
  BadgeCategory,
  CircleCategory,
  TransactionType,
  TransactionStatus,
  SettlementStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  await prisma.payment.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.insurance.deleteMany();
  await prisma.order.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.activityPhoto.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.circleMember.deleteMany();
  await prisma.circle.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.clubAccount.deleteMany();
  await prisma.refundPolicy.deleteMany();
  await prisma.insuranceProduct.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.route.deleteMany();
  await prisma.clubMember.deleteMany();
  await prisma.leaderProfile.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  const owners = await Promise.all(
    Array.from({ length: 3 }).map((_, i) =>
      prisma.user.create({
        data: {
          nickname: `Owner_${i + 1}`,
          openId: `wx_owner_${i + 1}`,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Owner${i + 1}`,
          phone: `13800000${String(100 + i)}`,
        },
      }),
    ),
  );

  const leaders = await Promise.all(
    Array.from({ length: 4 }).map((_, i) =>
      prisma.user.create({
        data: {
          nickname: `Leader_${i + 1}`,
          openId: `wx_leader_${i + 1}`,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Leader${i + 1}`,
          phone: `13800000${String(200 + i)}`,
          role: 'LEADER',
        },
      }),
    ),
  );

  const users = await Promise.all(
    Array.from({ length: 30 }).map((_, i) =>
      prisma.user.create({
        data: {
          nickname: `User_${i + 1}`,
          openId: `wx_user_${i + 1}`,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=User${i + 1}`,
          phone: `13900000${String(300 + i)}`,
        },
      }),
    ),
  );

  const clubs = await Promise.all(
    owners.map((o, i) =>
      prisma.club.create({
        data: {
          name: `Club_${i + 1}`,
          description: `Desc for Club_${i + 1}`,
          logo: `https://api.dicebear.com/7.x/identicon/svg?seed=Club${i + 1}`,
          ownerId: o.id,
          isVerified: true,
        },
      }),
    ),
  );

  await Promise.all(
    clubs.map((club, i) =>
      prisma.clubAccount.create({
        data: {
          clubId: club.id,
          balance: rnd(1000, 5000),
          totalIncome: rnd(2000, 8000),
          totalWithdraw: rnd(200, 1000),
        },
      }),
    ),
  );

  const leaderProfiles = await Promise.all(
    leaders.map((lu, i) =>
      prisma.leaderProfile.create({
        data: {
          userId: lu.id,
          realName: `Leader Real ${i + 1}`,
          idCard: `11010119900${String(10000 + i)}`,
          bio: `Bio ${i + 1}`,
          experience: rnd(10, 100),
          rating: 4 + Math.random(),
        },
      }),
    ),
  );

  await Promise.all(
    leaderProfiles.map((lp, i) =>
      prisma.clubMember.create({
        data: {
          clubId: clubs[i % clubs.length].id,
          leaderId: lp.id,
          role: 'LEADER',
        },
      }),
    ),
  );

  const routes = await Promise.all(
    Array.from({ length: 12 }).map((_, i) =>
      prisma.route.create({
        data: {
          name: `Route_${i + 1}`,
          difficulty: rnd(1, 5),
          distance: rnd(4, 30),
          elevation: rnd(50, 1500),
          gpxUrl: `http://example.com/route_${i + 1}.gpx`,
          description: `Route desc ${i + 1}`,
        },
      }),
    ),
  );

  const refundPolicies = await Promise.all(
    clubs.map((club, i) =>
      prisma.refundPolicy.create({
        data: {
          name: `Policy_${i + 1}`,
          description: `Policy desc ${i + 1}`,
          rules: JSON.stringify([
            { hoursBeforeStart: 168, refundPercent: 100 },
            { hoursBeforeStart: 72, refundPercent: 50 },
          ]),
          noRefundHours: 24,
          cancelRefundPercent: 100,
          clubId: club.id,
          isDefault: true,
        },
      }),
    ),
  );

  const insuranceProducts = await Promise.all(
    Array.from({ length: 3 }).map((_, i) =>
      prisma.insuranceProduct.create({
        data: {
          name: `Insurance_${i + 1}`,
          provider: 'Provider A',
          description: `Coverage ${i + 1}`,
          price: rnd(5, 20),
          coverage: JSON.stringify({ accident: true, rescue: true }),
          maxCompensation: rnd(10000, 50000),
          isActive: true,
        },
      }),
    ),
  );

  const now = new Date();
  const activities = await Promise.all(
    Array.from({ length: 16 }).map((_, i) => {
      const start = new Date(now);
      start.setDate(start.getDate() + rnd(-5, 10));
      const end = new Date(start);
      end.setHours(end.getHours() + rnd(4, 12));
      const statusPool = [
        ActivityStatus.PUBLISHED,
        ActivityStatus.FULL,
        ActivityStatus.ONGOING,
        ActivityStatus.COMPLETED,
      ];
      const status = pick(statusPool);
      return prisma.activity.create({
        data: {
          title: `Activity_${i + 1}`,
          coverUrl: `https://picsum.photos/seed/activity_${i + 1}/800/600`,
          startTime: start,
          endTime: end,
          price: rnd(49, 399),
          maxPeople: rnd(8, 30),
          minPeople: rnd(5, 10),
          status,
          clubId: clubs[i % clubs.length].id,
          leaderId: leaderProfiles[i % leaderProfiles.length].id,
          routeId: routes[i % routes.length].id,
          refundPolicyId: refundPolicies[i % refundPolicies.length].id,
          insuranceProductId: insuranceProducts[i % insuranceProducts.length].id,
        },
      });
    }),
  );

  const enrollments: { id: string; activityId: string; userId: string }[] = [];
  for (const act of activities) {
    const count = rnd(3, Math.min(10, act.maxPeople));
    const bundle = await prisma.enrollment.createMany({
      data: Array.from({ length: count }).map((_, j) => {
        const u = users[(j + rnd(0, users.length - 1)) % users.length];
        const sPool = [EnrollStatus.PENDING, EnrollStatus.PAID, EnrollStatus.CANCELLED];
        const s = pick(sPool);
        return {
          activityId: act.id,
          userId: u.id,
          amount: act.price,
          contactName: `Contact_${j + 1}`,
          contactPhone: `1391000${String(rnd(1000, 9999))}`,
          status: s,
        };
      }),
    });
    const created = await prisma.enrollment.findMany({ where: { activityId: act.id } });
    for (const e of created) enrollments.push({ id: e.id, activityId: act.id, userId: e.userId });
  }

  const orders: { id: string; activityId: string; clubId: string }[] = [];
  for (const e of enrollments.slice(0, Math.min(enrollments.length, 40))) {
    const act = activities.find((a) => a.id === e.activityId)!;
    const priceNum = Number(act.price);
    const statusPool = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.COMPLETED];
    const status = pick(statusPool);
    const order = await prisma.order.create({
      data: {
        orderNo: `ORD${Date.now()}${rnd(1000, 9999)}`,
        userId: e.userId,
        activityId: e.activityId,
        enrollmentId: e.id,
        amount: priceNum,
        insuranceFee: rnd(0, 30),
        totalAmount: priceNum + rnd(0, 30),
        status,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        verifyCode: Math.random() > 0.7 ? `V${rnd(100000, 999999)}` : null,
      },
    });
    orders.push({ id: order.id, activityId: e.activityId, clubId: clubs.find((c) => c.id === act.clubId)!.id });
    if (status === OrderStatus.PAID || status === OrderStatus.COMPLETED) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          gateway: 'WECHAT',
          prepayId: `pre_${rnd(100000, 999999)}`,
          transactionId: `tx_${rnd(100000, 999999)}`,
          openId: `wx_${rnd(1000, 9999)}`,
          status: PaymentStatus.SUCCESS,
          nonceStr: `nonce_${rnd(100000, 999999)}`,
        },
      });
      if (Math.random() > 0.6) {
        const prod = pick(insuranceProducts);
        await prisma.insurance.create({
          data: {
            orderId: order.id,
            productId: prod.id,
            amount: rnd(5, 20),
            insuredName: `Ins_${rnd(100, 999)}`,
            insuredPhone: `1392000${String(rnd(1000, 9999))}`,
            startDate: new Date(),
            endDate: new Date(Date.now() + 24 * 3600 * 1000),
            status: InsuranceStatus.ACTIVE,
          },
        });
      }
    }
    if (status === OrderStatus.CANCELLED && Math.random() > 0.5) {
      await prisma.refund.create({
        data: {
          orderId: order.id,
          refundNo: `RF${Date.now()}${rnd(1000, 9999)}`,
          amount: order.amount,
          reason: 'USER_CANCEL',
          status: RefundStatus.COMPLETED,
        },
      });
    }
  }

  const settlements = await Promise.all(
    activities.slice(0, 6).map((act, i) =>
      prisma.settlement.create({
        data: {
          settlementNo: `ST${Date.now()}${rnd(1000, 9999)}`,
          activityId: act.id,
          clubId: act.clubId,
          totalAmount: rnd(500, 3000),
          platformFee: rnd(20, 200),
          settleAmount: rnd(300, 2500),
          status: pick([SettlementStatus.PENDING, SettlementStatus.COMPLETED]),
        },
      }),
    ),
  );

  await Promise.all(
    settlements.map((s) =>
      prisma.transaction.create({
        data: {
          clubId: s.clubId,
          activityId: s.activityId,
          amount: s.settleAmount,
          type: TransactionType.SETTLEMENT,
          status: TransactionStatus.COMPLETED,
          balanceBefore: rnd(1000, 5000),
          balanceAfter: rnd(2000, 8000),
          description: 'Settlement',
        },
      }),
    ),
  );

  const circles = await Promise.all(
    Array.from({ length: 5 }).map((_, i) =>
      prisma.circle.create({
        data: {
          name: `Circle_${i + 1}`,
          description: `Circle desc ${i + 1}`,
          icon: `https://picsum.photos/seed/circle_${i + 1}/200/200`,
          coverUrl: `https://picsum.photos/seed/circle_cover_${i + 1}/800/300`,
          category: pick([CircleCategory.INTEREST, CircleCategory.REGION, CircleCategory.ACTIVITY]),
          creatorId: pick(users).id,
          clubId: Math.random() > 0.5 ? pick(clubs).id : null,
          isOfficial: Math.random() > 0.7,
        },
      }),
    ),
  );

  await Promise.all(
    circles.map((c) =>
      prisma.circleMember.create({
        data: {
          circleId: c.id,
          userId: pick(users).id,
          role: 'MEMBER',
        },
      }),
    ),
  );

  const posts = await Promise.all(
    Array.from({ length: 20 }).map((_, i) => {
      const u = pick(users);
      const act = Math.random() > 0.5 ? pick(activities) : null;
      const route = !act ? pick(routes) : null;
      const circle = Math.random() > 0.6 ? pick(circles) : null;
      return prisma.post.create({
        data: {
          userId: u.id,
          content: `Post content ${i + 1}`,
          activityId: act ? act.id : null,
          routeId: route ? route.id : null,
          circleId: circle ? circle.id : null,
          tags: ['户外', '徒步'],
        },
      });
    }),
  );

  await Promise.all(
    posts.map((p, i) =>
      prisma.postImage.create({
        data: {
          postId: p.id,
          url: `https://picsum.photos/seed/post_${i + 1}/600/400`,
          width: 600,
          height: 400,
          sortOrder: 0,
        },
      }),
    ),
  );

  await Promise.all(
    posts.slice(0, 10).map((p) =>
      prisma.postLike.create({
        data: {
          postId: p.id,
          userId: pick(users).id,
        },
      }),
    ),
  );

  await Promise.all(
    posts.slice(0, 10).map((p, i) =>
      prisma.comment.create({
        data: {
          postId: p.id,
          userId: pick(users).id,
          content: `Nice post ${i + 1}`,
        },
      }),
    ),
  );

  await Promise.all(
    activities.slice(0, 8).map((a, i) =>
      prisma.activityPhoto.create({
        data: {
          activityId: a.id,
          userId: pick(users).id,
          url: `https://picsum.photos/seed/activity_photo_${i + 1}/800/600`,
          description: `Photo ${i + 1}`,
          isFeatured: Math.random() > 0.7,
        },
      }),
    ),
  );

  const badges = await Promise.all(
    Array.from({ length: 6 }).map((_, i) =>
      prisma.badge.create({
        data: {
          name: `Badge_${i + 1}`,
          icon: `https://picsum.photos/seed/badge_${i + 1}/100/100`,
          description: `Badge desc ${i + 1}`,
          category: pick([
            BadgeCategory.MILESTONE,
            BadgeCategory.SOCIAL,
            BadgeCategory.CONTRIBUTION,
          ]),
          criteria: { level: i + 1 },
          sortOrder: i,
        },
      }),
    ),
  );

  await Promise.all(
    users.slice(0, 10).map((u) =>
      prisma.userBadge.create({
        data: {
          userId: u.id,
          badgeId: pick(badges).id,
        },
      }),
    ),
  );

  await Promise.all(
    users.slice(0, 10).map((u, i) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          type: 'SYSTEM',
          title: `欢迎加入蜂追 ${i + 1}`,
          content: '测试通知',
          isRead: Math.random() > 0.5,
        },
      }),
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
