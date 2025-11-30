import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ClubService {
  constructor(private prisma: PrismaService) {}

  async createClub(data: { name: string; ownerId: string; description?: string }) {
    return this.prisma.club.create({
      data: {
        name: data.name,
        owner: { connect: { id: data.ownerId } },
        description: data.description,
      },
    });
  }

  async getAllClubs() {
    return this.prisma.club.findMany({
      include: { owner: true },
    });
  }

  async getClubById(id: string) {
    return this.prisma.club.findUnique({
      where: { id },
      include: { members: true, activities: true },
    });
  }
}
