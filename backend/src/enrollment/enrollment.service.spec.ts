import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentService } from './enrollment.service';
import { PrismaService } from '../prisma.service';
import { ActivityStatus, EnrollStatus } from '@prisma/client';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

const mockPrismaService = {
  activity: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  enrollment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEnrollment', () => {
    const mockData = {
      activityId: 'act-1',
      userId: 'user-1',
      contactName: 'John Doe',
      contactPhone: '1234567890',
    };

    it('should successfully enroll a user', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.PUBLISHED,
        maxPeople: 10,
        price: 100,
        _count: { enrollments: 5 },
      });
      prisma.enrollment.findFirst.mockResolvedValue(null); // No existing enrollment
      prisma.enrollment.create.mockResolvedValue({
        id: 'enroll-1',
        status: EnrollStatus.PENDING,
        ...mockData,
      });

      const result = await service.createEnrollment(mockData);

      expect(result).toBeDefined();
      expect(prisma.enrollment.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if activity does not exist', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);

      await expect(service.createEnrollment(mockData)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if activity is not published', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.DRAFT,
        _count: { enrollments: 0 },
      });

      await expect(service.createEnrollment(mockData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if activity is full', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.PUBLISHED,
        maxPeople: 5,
        _count: { enrollments: 5 },
      });

      await expect(service.createEnrollment(mockData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if user already enrolled', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: 'act-1',
        status: ActivityStatus.PUBLISHED,
        maxPeople: 10,
        _count: { enrollments: 5 },
      });
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enroll-existing',
        status: EnrollStatus.PAID,
      });

      await expect(service.createEnrollment(mockData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update activity status to FULL if maxPeople reached', async () => {
        prisma.activity.findUnique.mockResolvedValue({
          id: 'act-1',
          status: ActivityStatus.PUBLISHED,
          maxPeople: 10,
          price: 100,
          _count: { enrollments: 9 }, // 9 + 1 = 10 (Full)
        });
        prisma.enrollment.findFirst.mockResolvedValue(null);
        prisma.enrollment.create.mockResolvedValue({
            id: 'enroll-1',
            status: EnrollStatus.PENDING,
            ...mockData,
        });
  
        await service.createEnrollment(mockData);
  
        expect(prisma.activity.update).toHaveBeenCalledWith({
          where: { id: 'act-1' },
          data: { status: ActivityStatus.FULL },
        });
      });
  });
});
