import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma.service';
import { NotificationType } from '@prisma/client';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const dto = {
        type: NotificationType.SYSTEM,
        title: 'Test Notification',
        content: 'Test Content',
      };
      mockPrismaService.notification.create.mockResolvedValue({ id: '1', ...dto });

      await service.createNotification('user1', dto);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          ...dto,
        },
      });
    });
  });

  describe('getNotifications', () => {
    it('should return notifications', async () => {
      const notifications = [{ id: '1', title: 'Test' }];
      mockPrismaService.notification.findMany.mockResolvedValue(notifications);

      const result = await service.getNotifications('user1');

      expect(result.notifications).toEqual(notifications);
      expect(result.hasMore).toBe(false);
      expect(prisma.notification.findMany).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue({ id: '1' });
      mockPrismaService.notification.update.mockResolvedValue({ id: '1', isRead: true });

      const result = await service.markAsRead('1', 'user1');

      expect(result).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isRead: true },
      });
    });

    it('should return false if notification not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      const result = await service.markAsRead('1', 'user1');

      expect(result).toBe(false);
    });
  });
});
