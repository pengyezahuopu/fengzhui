import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma.service';
import { ActivityStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  club: {
    findUnique: jest.fn(),
  },
  leaderProfile: {
    findUnique: jest.fn(),
  },
  route: {
    findUnique: jest.fn(),
  },
  activity: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createActivity', () => {
    const mockData = {
      title: 'Weekend Hike',
      startTime: new Date(),
      endTime: new Date(),
      routeId: 'route-1',
      clubId: 'club-1',
      leaderId: 'leader-1',
      price: 100,
      maxPeople: 20,
    };

    it('should successfully create an activity', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'club-1' });
      prisma.leaderProfile.findUnique.mockResolvedValue({ id: 'leader-1' });
      prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
      prisma.activity.create.mockResolvedValue({
        id: 'act-1',
        ...mockData,
        status: ActivityStatus.DRAFT,
      });

      const result = await service.createActivity(mockData);
      expect(result).toBeDefined();
      expect(result.id).toBe('act-1');
    });

    it('should throw NotFoundException if club not found', async () => {
      prisma.club.findUnique.mockResolvedValue(null);
      await expect(service.createActivity(mockData)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publishActivity', () => {
    it('should publish a draft activity', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.DRAFT,
      });
      prisma.activity.update.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.PUBLISHED,
      });

      const result = await service.publishActivity('act-1');
      expect(result.status).toBe(ActivityStatus.PUBLISHED);
    });

    it('should throw BadRequestException if activity is already published', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.PUBLISHED,
      });

      await expect(service.publishActivity('act-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
