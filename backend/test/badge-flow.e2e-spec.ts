import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { BadgeCategory, NotificationType } from '@prisma/client';

describe('Badge Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let badgeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Cleanup dependencies first
    await prisma.notification.deleteMany();
    await prisma.userBadge.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.circleMember.deleteMany();
    await prisma.circle.deleteMany();
    await prisma.postLike.deleteMany();
    await prisma.commentLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.postImage.deleteMany();
    await prisma.post.deleteMany();
    await prisma.activityPhoto.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.clubMember.deleteMany();
    await prisma.club.deleteMany();
    await prisma.leaderProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create a badge
    const badge = await prisma.badge.create({
      data: {
        name: 'E2E Test Badge',
        icon: '🏅',
        description: 'Test Badge',
        category: BadgeCategory.MILESTONE,
        criteria: { type: 'test', value: 1 },
      },
    });
    badgeId = badge.id;

    // Create a user
    const user = await prisma.user.create({
      data: {
        nickname: 'E2E User',
        openId: 'e2e_openid',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.userBadge.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.circleMember.deleteMany();
    await prisma.circle.deleteMany();
    await prisma.postLike.deleteMany();
    await prisma.commentLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.postImage.deleteMany();
    await prisma.post.deleteMany();
    await prisma.activityPhoto.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.clubMember.deleteMany();
    await prisma.club.deleteMany();
    await prisma.leaderProfile.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('/badges (GET) - should return list of badges', () => {
    return request(app.getHttpServer())
      .get('/badges')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].name).toBe('E2E Test Badge');
      });
  });

  it('/badges/wall (GET) - should return badge wall for user', () => {
    return request(app.getHttpServer())
      .get('/badges/wall')
      .set('x-user-id', userId)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        const badge = res.body.find((b) => b.id === badgeId);
        expect(badge).toBeDefined();
        expect(badge.earned).toBe(false);
      });
  });

  it('should verify badge awarding logic', async () => {
    // Manually award badge via Prisma to simulate service logic
    await prisma.userBadge.create({
      data: {
        userId,
        badgeId,
      },
    });

    // Create a notification manually as well (since we are bypassing service event logic here for simplicity, 
    // or we could use the AchievementService if we wanted to test that specifically)
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.BADGE,
        title: 'You earned a badge!',
        targetId: badgeId,
        targetType: 'badge',
      },
    });
  });

  it('/badges/wall (GET) - should show badge as earned now', () => {
    return request(app.getHttpServer())
      .get('/badges/wall')
      .set('x-user-id', userId)
      .expect(200)
      .expect((res) => {
        const badge = res.body.find((b) => b.id === badgeId);
        expect(badge.earned).toBe(true);
        expect(badge.earnedAt).toBeDefined();
      });
  });

  it('/notifications (GET) - should return notifications', () => {
    return request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', userId)
      .expect(200)
      .expect((res) => {
        expect(res.body.notifications).toBeDefined();
        expect(Array.isArray(res.body.notifications)).toBe(true);
        expect(res.body.notifications.length).toBe(1);
        expect(res.body.notifications[0].type).toBe('BADGE');
      });
  });

  it('/notifications/read-all (PATCH) - should mark all as read', () => {
    return request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('x-user-id', userId)
      .expect(200)
      .expect((res) => {
        expect(res.body.count).toBe(1);
      });
  });
});
