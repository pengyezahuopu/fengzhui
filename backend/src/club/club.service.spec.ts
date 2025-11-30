import { Test, TestingModule } from '@nestjs/testing';
import { ClubService } from './club.service';
import { PrismaService } from '../prisma.service';

describe('ClubService', () => {
  let service: ClubService;
  let prisma: PrismaService;

  const mockPrisma = {
    club: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ClubService>(ClubService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createClub', () => {
    it('should create a club', async () => {
      const input = {
        name: 'Test Club',
        ownerId: 'owner-123',
        description: 'A test club',
      };

      mockPrisma.club.create.mockResolvedValue({ id: 'club-123', ...input });

      const result = await service.createClub(input);

      expect(prisma.club.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          owner: { connect: { id: input.ownerId } },
          description: input.description,
        },
      });
      expect(result).toHaveProperty('id', 'club-123');
    });
  });

  describe('getAllClubs', () => {
    it('should return an array of clubs', async () => {
      const clubs = [{ id: 'club-1', name: 'Club 1' }];
      mockPrisma.club.findMany.mockResolvedValue(clubs);

      const result = await service.getAllClubs();

      expect(prisma.club.findMany).toHaveBeenCalledWith({
        include: { owner: true },
      });
      expect(result).toEqual(clubs);
    });
  });
});
