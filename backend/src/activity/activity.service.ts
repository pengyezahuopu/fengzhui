import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityStatus } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  // 创建活动
  async createActivity(data: {
    title: string;
    coverUrl?: string;
    startTime: Date;
    endTime: Date;
    routeId: string;
    clubId: string;
    leaderId: string;
    price: number;
    maxPeople: number;
    minPeople?: number;
  }) {
    // 验证俱乐部和领队存在
    const club = await this.prisma.club.findUnique({
      where: { id: data.clubId },
    });
    if (!club) {
      throw new NotFoundException('Club not found');
    }

    const leader = await this.prisma.leaderProfile.findUnique({
      where: { id: data.leaderId },
    });
    if (!leader) {
      throw new NotFoundException('Leader not found');
    }

    const route = await this.prisma.route.findUnique({
      where: { id: data.routeId },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return this.prisma.activity.create({
      data: {
        title: data.title,
        coverUrl: data.coverUrl,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        routeId: data.routeId,
        clubId: data.clubId,
        leaderId: data.leaderId,
        price: data.price,
        maxPeople: data.maxPeople,
        minPeople: data.minPeople || 5,
        status: ActivityStatus.DRAFT,
      },
      include: {
        route: true,
        club: true,
        leader: {
          include: {
            user: {
              select: {
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // 获取活动列表（支持分页和筛选）
  async getActivities(params: {
    page?: number;
    limit?: number;
    status?: ActivityStatus;
    clubId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.clubId) {
      where.clubId = params.clubId;
    }

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: {
          route: true,
          club: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          leader: {
            include: {
              user: {
                select: {
                  nickname: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 获取活动详情
  async getActivityById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        route: true,
        club: true,
        leader: {
          include: {
            user: {
              select: {
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    return activity;
  }

  // 更新活动
  async updateActivity(
    id: string,
    data: {
      title?: string;
      coverUrl?: string;
      startTime?: Date;
      endTime?: Date;
      price?: number;
      maxPeople?: number;
      minPeople?: number;
      status?: ActivityStatus;
    },
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
    });
  }

  // 发布活动
  async publishActivity(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    if (activity.status !== ActivityStatus.DRAFT) {
      throw new BadRequestException('Only draft activities can be published');
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.PUBLISHED },
    });
  }

  // 取消活动
  async cancelActivity(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.CANCELLED },
    });
  }

  // 删除活动
  async deleteActivity(id: string) {
    return this.prisma.activity.delete({
      where: { id },
    });
  }

  // 获取推荐活动（首页展示）
  async getRecommendedActivities(limit: number = 10) {
    return this.prisma.activity.findMany({
      where: {
        status: ActivityStatus.PUBLISHED,
        startTime: {
          gte: new Date(),
        },
      },
      take: limit,
      orderBy: { startTime: 'asc' },
      include: {
        route: true,
        club: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });
  }
}
