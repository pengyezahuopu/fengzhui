import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role, ClubRole } from '@prisma/client';

@Injectable()
export class LeaderService {
  constructor(private prisma: PrismaService) {}

  // 认证领队
  async createLeaderProfile(data: { userId: string; realName: string; idCard: string; bio?: string }) {
    // 1. 创建领队档案
    const profile = await this.prisma.leaderProfile.create({
      data: {
        userId: data.userId,
        realName: data.realName,
        idCard: data.idCard, // 实际应加密
        bio: data.bio,
      },
    });

    // 2. 更新用户角色
    await this.prisma.user.update({
      where: { id: data.userId },
      data: { role: Role.LEADER },
    });

    return profile;
  }

  // 挂靠俱乐部
  async joinClub(leaderProfileId: string, clubId: string) {
    return this.prisma.clubMember.create({
      data: {
        clubId: clubId,
        leaderId: leaderProfileId,
        role: ClubRole.LEADER,
      },
    });
  }

  async getLeaderById(id: string) {
    return this.prisma.leaderProfile.findUnique({
      where: { id },
      include: { user: true, clubMemberships: { include: { club: true } } },
    });
  }
}
