import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // 获取所有用户
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        openId: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // 根据ID获取用户
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        leaderProfile: true,
        enrollments: {
          include: {
            activity: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  // 创建用户（简化版本，用于测试）
  async createUser(data: {
    openId?: string;
    phone?: string;
    nickname?: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({
      data: {
        openId: data.openId,
        phone: data.phone,
        nickname: data.nickname,
        avatarUrl: data.avatarUrl,
      },
    });
  }

  // 更新用户信息
  async updateUser(
    id: string,
    data: {
      nickname?: string;
      avatarUrl?: string;
      phone?: string;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // 根据openId查找或创建用户（模拟微信登录）
  async findOrCreateByOpenId(openId: string, userInfo?: { nickname?: string; avatarUrl?: string }) {
    let user = await this.prisma.user.findUnique({
      where: { openId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openId,
          nickname: userInfo?.nickname || `用户${openId.substring(0, 6)}`,
          avatarUrl: userInfo?.avatarUrl,
        },
      });
    }

    return user;
  }

  // 获取用户的报名列表
  async getUserEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        activity: {
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
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取用户完整个人资料（含社交数据）
   */
  async getUserProfile(userId: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        leaderProfile: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`用户不存在`);
    }

    // 检查当前用户是否关注了该用户
    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      leaderProfile: user.leaderProfile,
      postCount: user._count.posts,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      isFollowing,
    };
  }

  /**
   * 获取用户统计数据（活动数、里程、爬升等）
   */
  async getUserStats(userId: string) {
    // 获取已完成的活动报名
    const completedEnrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: 'CHECKED_IN', // 已签到的活动
      },
      include: {
        activity: {
          include: {
            route: true,
          },
        },
      },
    });

    // 计算统计数据
    let totalDistance = 0;
    let totalElevation = 0;
    const activityCount = completedEnrollments.length;

    for (const enrollment of completedEnrollments) {
      if (enrollment.activity.route) {
        totalDistance += enrollment.activity.route.distance || 0;
        totalElevation += enrollment.activity.route.elevation || 0;
      }
    }

    // 获取帖子数
    const postCount = await this.prisma.post.count({
      where: { userId },
    });

    // 获取获得的勋章数
    const badgeCount = await this.prisma.userBadge.count({
      where: { userId },
    });

    // 获取加入的圈子数
    const circleCount = await this.prisma.circleMember.count({
      where: { userId },
    });

    // 获取上传的活动照片数
    const photoCount = await this.prisma.activityPhoto.count({
      where: { userId },
    });

    return {
      activityCount,
      totalDistance: Math.round(totalDistance * 10) / 10, // 保留一位小数
      totalElevation: Math.round(totalElevation),
      postCount,
      badgeCount,
      circleCount,
      photoCount,
    };
  }

  /**
   * 获取用户的帖子列表
   */
  async getUserPosts(userId: string, options: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = options;

    const posts = await this.prisma.post.findMany({
      where: { userId },
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
        activity: {
          select: { id: true, title: true },
        },
        route: {
          select: { id: true, name: true },
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
   * 获取用户的勋章列表
   */
  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });
  }
}
