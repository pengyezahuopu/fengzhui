import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationService } from './notification.service';
import { Badge, BadgeCategory, EnrollStatus } from '@prisma/client';

interface BadgeCriteria {
  type: string;
  threshold: number;
  condition?: Record<string, any>;
}

@Injectable()
export class AchievementService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /**
   * 获取所有勋章定义
   */
  async getBadges(category?: BadgeCategory): Promise<Badge[]> {
    const where = category ? { category } : {};

    return this.prisma.badge.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  /**
   * 获取用户已获得的勋章
   */
  async getUserBadges(userId: string) {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });

    return userBadges.map((ub) => ({
      ...ub.badge,
      earnedAt: ub.earnedAt,
    }));
  }

  /**
   * 获取用户勋章墙 (所有勋章 + 获得状态)
   */
  async getBadgeWall(userId: string) {
    const [allBadges, userBadges] = await Promise.all([
      this.getBadges(),
      this.prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
      }),
    ]);

    const earnedMap = new Map(
      userBadges.map((ub) => [ub.badgeId, ub.earnedAt]),
    );

    return allBadges.map((badge) => ({
      ...badge,
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) || null,
    }));
  }

  /**
   * 授予勋章
   */
  async awardBadge(userId: string, badgeId: string): Promise<boolean> {
    // 检查是否已获得
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId },
      },
    });

    if (existing) {
      return false; // 已获得，不重复授予
    }

    // 获取勋章信息
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
    });

    if (!badge) {
      return false;
    }

    // 创建用户勋章记录
    await this.prisma.userBadge.create({
      data: { userId, badgeId },
    });

    // 发送通知
    await this.notificationService.notifyBadge(
      userId,
      badge.name,
      badge.icon,
      badgeId,
    );

    return true;
  }

  /**
   * 检查并授予符合条件的勋章
   */
  async checkAchievements(userId: string): Promise<string[]> {
    const awardedBadges: string[] = [];

    // 获取所有未获得的勋章
    const userBadgeIds = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const earnedIds = new Set(userBadgeIds.map((ub) => ub.badgeId));

    const allBadges = await this.prisma.badge.findMany();
    const unearned = allBadges.filter((b) => !earnedIds.has(b.id));

    // 获取用户统计数据
    const stats = await this.getUserAchievementStats(userId);

    // 检查每个未获得的勋章
    for (const badge of unearned) {
      const criteria = badge.criteria as unknown as BadgeCriteria;

      if (this.checkCriteria(criteria, stats)) {
        const awarded = await this.awardBadge(userId, badge.id);
        if (awarded) {
          awardedBadges.push(badge.name);
        }
      }
    }

    return awardedBadges;
  }

  /**
   * 获取用户成就统计数据
   */
  private async getUserAchievementStats(userId: string) {
    // 并行获取所有统计数据
    const [
      activityCount,
      distanceAndElevation,
      postCount,
      routeCount,
      followerCount,
      leaderProfile,
      ledActivityCount,
    ] = await Promise.all([
      // 参与活动数
      this.prisma.enrollment.count({
        where: { userId, status: EnrollStatus.CHECKED_IN },
      }),
      // 里程和爬升
      this.getDistanceAndElevation(userId),
      // 帖子数
      this.prisma.post.count({ where: { userId } }),
      // 贡献线路数
      this.prisma.route.count({ where: { creatorId: userId } }),
      // 粉丝数
      this.prisma.follow.count({ where: { followingId: userId } }),
      // 领队资格
      this.prisma.leaderProfile.findUnique({ where: { userId } }),
      // 带队活动数
      this.prisma.activity.count({
        where: {
          leader: { userId },
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      activity_count: activityCount,
      distance: distanceAndElevation.distance,
      elevation: distanceAndElevation.elevation,
      post_count: postCount,
      route_count: routeCount,
      follower_count: followerCount,
      leader_certified: leaderProfile ? 1 : 0,
      led_activity_count: ledActivityCount,
    };
  }

  /**
   * 获取用户累计里程和爬升
   */
  private async getDistanceAndElevation(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: EnrollStatus.CHECKED_IN },
      include: {
        activity: {
          include: { route: true },
        },
      },
    });

    let distance = 0;
    let elevation = 0;

    for (const enrollment of enrollments) {
      if (enrollment.activity?.route) {
        distance += enrollment.activity.route.distance || 0;
        elevation += enrollment.activity.route.elevation || 0;
      }
    }

    return { distance, elevation };
  }

  /**
   * 检查勋章条件是否满足
   */
  private checkCriteria(
    criteria: BadgeCriteria,
    stats: Record<string, number>,
  ): boolean {
    const { type, threshold } = criteria;

    // 基础类型检查
    const value = stats[type];
    if (value !== undefined && value >= threshold) {
      return true;
    }

    // 特殊类型检查 (需要额外逻辑)
    // weekly_activity, consecutive_weeks, early_activity, night_activity
    // 这些类型需要在事件监听器中处理

    return false;
  }

  /**
   * 根据事件类型检查成就
   * 用于事件驱动的勋章检查
   */
  async checkAchievementsByEvent(
    userId: string,
    eventType: string,
    eventData?: Record<string, any>,
  ): Promise<string[]> {
    const awardedBadges: string[] = [];

    // 获取与事件相关的勋章类型
    const relatedTypes = this.getRelatedBadgeTypes(eventType);

    // 获取用户未获得的相关勋章
    const userBadgeIds = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const earnedIds = new Set(userBadgeIds.map((ub) => ub.badgeId));

    const relatedBadges = await this.prisma.badge.findMany({
      where: {
        criteria: {
          path: ['type'],
          string_contains: relatedTypes[0], // 简化：只检查第一个类型
        },
      },
    });

    const unearned = relatedBadges.filter((b) => !earnedIds.has(b.id));

    if (unearned.length === 0) {
      return awardedBadges;
    }

    // 获取用户统计数据
    const stats = await this.getUserAchievementStats(userId);

    // 处理特殊事件类型
    if (eventType === 'activity.checked_in' && eventData) {
      // 检查早起鸟勋章
      if (eventData.startHour !== undefined && eventData.startHour < 5) {
        stats['early_activity'] = 1;
      }
      // 检查夜行侠勋章
      if (eventData.isNightActivity) {
        stats['night_activity'] = 1;
      }
    }

    // 检查每个未获得的相关勋章
    for (const badge of unearned) {
      const criteria = badge.criteria as unknown as BadgeCriteria;

      if (this.checkCriteria(criteria, stats)) {
        const awarded = await this.awardBadge(userId, badge.id);
        if (awarded) {
          awardedBadges.push(badge.name);
        }
      }
    }

    return awardedBadges;
  }

  /**
   * 获取事件相关的勋章类型
   */
  private getRelatedBadgeTypes(eventType: string): string[] {
    const mapping: Record<string, string[]> = {
      'enrollment.checked_in': [
        'activity_count',
        'distance',
        'elevation',
        'early_activity',
        'night_activity',
      ],
      'activity.completed': ['activity_count', 'led_activity_count'],
      'post.created': ['post_count'],
      'route.created': ['route_count'],
      'follow.created': ['follower_count'],
      'leader.certified': ['leader_certified'],
    };

    return mapping[eventType] || [];
  }
}
