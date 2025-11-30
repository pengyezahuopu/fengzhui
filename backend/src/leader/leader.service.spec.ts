import { Test, TestingModule } from '@nestjs/testing';
import { LeaderService } from './leader.service';
import { PrismaService } from '../prisma.service';
import { Role, ClubRole } from '@prisma/client';

describe('LeaderService', () => {
  let service: LeaderService;
  let prisma: PrismaService;

  const mockPrisma = {
    leaderProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    clubMember: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<LeaderService>(LeaderService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLeaderProfile', () => {
    it('should create a leader profile and update user role', async () => {
      const input = {
        userId: 'user-123',
        realName: 'Test Leader',
        idCard: '123456',
        bio: 'Test Bio',
      };

      mockPrisma.leaderProfile.create.mockResolvedValue({ id: 'profile-123', ...input });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123', role: Role.LEADER });

      const result = await service.createLeaderProfile(input);

      expect(prisma.leaderProfile.create).toHaveBeenCalledWith({
        data: input,
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: input.userId },
        data: { role: Role.LEADER },
      });
      expect(result).toHaveProperty('id', 'profile-123');
    });
  });

  describe('joinClub', () => {
    it('should create a club membership with LEADER role', async () => {
      const input = {
        leaderProfileId: 'profile-123',
        clubId: 'club-123',
      };

      mockPrisma.clubMember.create.mockResolvedValue({
        id: 'member-123',
        clubId: input.clubId,
        leaderId: input.leaderProfileId,
        role: ClubRole.LEADER,
      });

      const result = await service.joinClub(input.leaderProfileId, input.clubId);

      expect(prisma.clubMember.create).toHaveBeenCalledWith({
        data: {
          clubId: input.clubId,
          leaderId: input.leaderProfileId,
          role: ClubRole.LEADER,
        },
      });
      expect(result.role).toBe(ClubRole.LEADER);
    });
  });
});
