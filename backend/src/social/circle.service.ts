import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContentSecurityService } from '../common/content-security/content-security.service';
import { CircleCategory, CircleRole } from '@prisma/client';

interface CreateCircleDto {
  name: string;
  description?: string;
  icon?: string;
  coverUrl?: string;
  category?: CircleCategory;
  clubId?: string;
}

interface UpdateCircleDto {
  name?: string;
  description?: string;
  icon?: string;
  coverUrl?: string;
}

@Injectable()
export class CircleService {
  constructor(
    private prisma: PrismaService,
    private contentSecurity: ContentSecurityService,
  ) {}

  /**
   * 创建圈子
   */
  async createCircle(creatorId: string, dto: CreateCircleDto) {
    // 内容安全检测
    const nameCheck = await this.contentSecurity.checkContent(dto.name);
    if (!nameCheck.pass) {
      throw new BadRequestException(nameCheck.reason || '圈子名称包含敏感内容');
    }

    if (dto.description) {
      const descCheck = await this.contentSecurity.checkContent(dto.description);
      if (!descCheck.pass) {
        throw new BadRequestException(descCheck.reason || '圈子简介包含敏感内容');
      }
    }

    // 创建圈子并添加创建者为管理员
    const circle = await this.prisma.circle.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        coverUrl: dto.coverUrl,
        category: dto.category || CircleCategory.INTEREST,
        creatorId,
        clubId: dto.clubId,
        memberCount: 1,
        members: {
          create: {
            userId: creatorId,
            role: CircleRole.OWNER,
          },
        },
      },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: { select: { members: true, posts: true } },
      },
    });

    return circle;
  }

  /**
   * 获取圈子列表
   */
  async getCircles(options: {
    category?: CircleCategory;
    keyword?: string;
    cursor?: string;
    limit?: number;
  }) {
    const { category, keyword, cursor, limit = 20 } = options;

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    const circles = await this.prisma.circle.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ memberCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: { select: { members: true, posts: true } },
      },
    });

    const hasMore = circles.length > limit;
    const data = hasMore ? circles.slice(0, -1) : circles;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { circles: data, nextCursor };
  }

  /**
   * 获取圈子详情
   */
  async getCircleById(circleId: string, userId?: string) {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        club: {
          select: { id: true, name: true, logo: true },
        },
        members: {
          take: 10,
          orderBy: { joinedAt: 'asc' },
          include: {
            user: {
              select: { id: true, nickname: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { members: true, posts: true } },
      },
    });

    if (!circle) {
      throw new NotFoundException('圈子不存在');
    }

    // 检查当前用户是否已加入
    let membership = null;
    if (userId) {
      membership = await this.prisma.circleMember.findUnique({
        where: {
          circleId_userId: { circleId, userId },
        },
      });
    }

    return {
      ...circle,
      isJoined: !!membership,
      myRole: membership?.role || null,
    };
  }

  /**
   * 加入圈子
   */
  async joinCircle(circleId: string, userId: string) {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      throw new NotFoundException('圈子不存在');
    }

    // 检查是否已加入
    const existing = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId },
      },
    });

    if (existing) {
      throw new BadRequestException('已经加入该圈子');
    }

    // 创建成员关系并更新计数
    await this.prisma.$transaction([
      this.prisma.circleMember.create({
        data: {
          circleId,
          userId,
          role: CircleRole.MEMBER,
        },
      }),
      this.prisma.circle.update({
        where: { id: circleId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    return { success: true };
  }

  /**
   * 退出圈子
   */
  async leaveCircle(circleId: string, userId: string) {
    const membership = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId },
      },
    });

    if (!membership) {
      throw new BadRequestException('未加入该圈子');
    }

    // 圈主不能退出
    if (membership.role === CircleRole.OWNER) {
      throw new ForbiddenException('圈主不能退出圈子，请先转让圈主');
    }

    // 删除成员关系并更新计数
    await this.prisma.$transaction([
      this.prisma.circleMember.delete({
        where: {
          circleId_userId: { circleId, userId },
        },
      }),
      this.prisma.circle.update({
        where: { id: circleId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    return { success: true };
  }

  /**
   * 获取圈子帖子
   */
  async getCirclePosts(circleId: string, options: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = options;

    const posts = await this.prisma.post.findMany({
      where: { circleId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { posts: data, nextCursor };
  }

  /**
   * 获取圈子成员列表
   */
  async getCircleMembers(circleId: string, options: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = options;

    const members = await this.prisma.circleMember.findMany({
      where: { circleId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });

    const hasMore = members.length > limit;
    const data = hasMore ? members.slice(0, -1) : members;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { members: data, nextCursor };
  }

  /**
   * 更新圈子信息
   */
  async updateCircle(circleId: string, userId: string, dto: UpdateCircleDto) {
    // 检查权限
    const membership = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId },
      },
    });

    if (!membership || (membership.role !== CircleRole.OWNER && membership.role !== CircleRole.ADMIN)) {
      throw new ForbiddenException('无权限修改圈子信息');
    }

    // 内容安全检测
    if (dto.name) {
      const nameCheck = await this.contentSecurity.checkContent(dto.name);
      if (!nameCheck.pass) {
        throw new BadRequestException(nameCheck.reason || '圈子名称包含敏感内容');
      }
    }

    if (dto.description) {
      const descCheck = await this.contentSecurity.checkContent(dto.description);
      if (!descCheck.pass) {
        throw new BadRequestException(descCheck.reason || '圈子简介包含敏感内容');
      }
    }

    return this.prisma.circle.update({
      where: { id: circleId },
      data: dto,
      include: {
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: { select: { members: true, posts: true } },
      },
    });
  }

  /**
   * 检查用户是否为圈子成员
   */
  async isMember(circleId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.circleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId },
      },
    });
    return !!membership;
  }

  /**
   * 获取用户加入的圈子
   */
  async getUserCircles(userId: string, options: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = options;

    const memberships = await this.prisma.circleMember.findMany({
      where: { userId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { joinedAt: 'desc' },
      include: {
        circle: {
          include: {
            creator: {
              select: { id: true, nickname: true, avatarUrl: true },
            },
            _count: { select: { members: true, posts: true } },
          },
        },
      },
    });

    const hasMore = memberships.length > limit;
    const data = hasMore ? memberships.slice(0, -1) : memberships;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      circles: data.map((m) => ({ ...m.circle, myRole: m.role })),
      nextCursor,
    };
  }
}
