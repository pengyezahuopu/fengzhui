import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CircleRole } from '@prisma/client';

@Injectable()
export class CircleService {
  constructor(private prisma: PrismaService) {}

  async createCircle(data: {
    name: string;
    description?: string;
    creatorId: string;
    category?: any;
  }) {
    return this.prisma.circle.create({
      data: {
        ...data,
        members: {
          create: {
            userId: data.creatorId,
            role: CircleRole.OWNER,
          },
        },
      },
    });
  }

  async joinCircle(circleId: string, userId: string) {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) throw new NotFoundException('Circle not found');

    try {
      return await this.prisma.circleMember.create({
        data: { circleId, userId, role: CircleRole.MEMBER },
      });
    } catch (e) {
      throw new ConflictException('Already a member');
    }
  }

  async leaveCircle(circleId: string, userId: string) {
    const member = await this.prisma.circleMember.findUnique({
      where: { circleId_userId: { circleId, userId } },
    });
    
    if (!member) throw new NotFoundException('Not a member');
    if (member.role === CircleRole.OWNER) {
        throw new ConflictException('Owner cannot leave circle');
    }

    return this.prisma.circleMember.delete({
      where: { id: member.id },
    });
  }
}
