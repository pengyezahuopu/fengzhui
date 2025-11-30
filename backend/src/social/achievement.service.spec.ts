import { Test, TestingModule } from '@nestjs/testing';
import { AchievementService } from './achievement.service';
import { PrismaService } from '../prisma.service';
import { NotificationService } from './notification.service';
import { BadgeCategory } from '@prisma/client';

describe('AchievementService', () => {
  let service: AchievementService;
  let prisma: PrismaService;
  let notificationService: NotificationService;

  const mockPrismaService = {
    badge: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userBadge: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    enrollment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    post: {
      count: jest.fn(),
    },
    route: {
      count: jest.fn(),
    },
    follow: {
      count: jest.fn(),
    },
    leaderProfile: {
      findUnique: jest.fn(),
    },
    activity: {
      count: jest.fn(),
    },
  };

  const mockNotificationService = {
    notifyBadge: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBadges', () => {
    it('should return all badges', async () => {
      const badges = [{ id: '1', name: 'Hiker' }];
      mockPrismaService.badge.findMany.mockResolvedValue(badges);

      const result = await service.getBadges();
      expect(result).toEqual(badges);
      expect(prisma.badge.findMany).toHaveBeenCalled();
    });

    it('should return badges by category', async () => {
      const badges = [{ id: '1', name: 'Hiker', category: BadgeCategory.MILESTONE }];
      mockPrismaService.badge.findMany.mockResolvedValue(badges);

      const result = await service.getBadges(BadgeCategory.MILESTONE);
      expect(result).toEqual(badges);
      expect(prisma.badge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: BadgeCategory.MILESTONE } })
      );
    });
  });

  describe('awardBadge', () => {
    it('should return false if badge already earned', async () => {
      mockPrismaService.userBadge.findUnique.mockResolvedValue({ id: '1' });

      const result = await service.awardBadge('user1', 'badge1');
      expect(result).toBe(false);
    });

    it('should return false if badge not found', async () => {
      mockPrismaService.userBadge.findUnique.mockResolvedValue(null);
      mockPrismaService.badge.findUnique.mockResolvedValue(null);

      const result = await service.awardBadge('user1', 'badge1');
      expect(result).toBe(false);
    });

    it('should award badge and notify', async () => {
      const badge = { id: 'badge1', name: 'First Hike', icon: '🥾' };
      mockPrismaService.userBadge.findUnique.mockResolvedValue(null);
      mockPrismaService.badge.findUnique.mockResolvedValue(badge);
      mockPrismaService.userBadge.create.mockResolvedValue({ id: 'ub1', userId: 'user1', badgeId: 'badge1' });

      const result = await service.awardBadge('user1', 'badge1');
      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalledWith({
        data: { userId: 'user1', badgeId: 'badge1' },
      });
      expect(notificationService.notifyBadge).toHaveBeenCalledWith(
        'user1',
        badge.name,
        badge.icon,
        badge.id
      );
    });
  });
});
