import { Test, TestingModule } from '@nestjs/testing';
import { CircleService } from './circle.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CircleRole } from '@prisma/client';

const mockPrismaService = {
  circle: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  circleMember: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CircleService', () => {
  let service: CircleService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircleService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CircleService>(CircleService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCircle', () => {
    it('should create circle with owner member', async () => {
      const input = { name: 'Test', creatorId: 'u1' };
      prisma.circle.create.mockResolvedValue({ id: 'c1', ...input });

      await service.createCircle(input);
      expect(prisma.circle.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          members: { create: { userId: 'u1', role: CircleRole.OWNER } }
        })
      }));
    });
  });

  describe('joinCircle', () => {
    it('should join successfully', async () => {
      prisma.circle.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.circleMember.create.mockResolvedValue({ id: 'm1' });

      await service.joinCircle('c1', 'u2');
      expect(prisma.circleMember.create).toHaveBeenCalled();
    });

    it('should throw if circle not found', async () => {
      prisma.circle.findUnique.mockResolvedValue(null);
      await expect(service.joinCircle('c1', 'u2')).rejects.toThrow(NotFoundException);
    });
  });
});
