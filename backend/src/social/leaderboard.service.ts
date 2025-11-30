import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis';
import { EnrollStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
}

// Redis 排行榜键名
const LEADERBOARD_KEYS = {
  ROUTE_CONTRIBUTION: 'leaderboard:route_contribution',
  ACTIVITY_COUNT: 'leaderboard:activity_count',
  TOTAL_DISTANCE: 'leaderboard:total_distance',
  TOTAL_ELEVATION: 'leaderboard:total_elevation',
  BADGE_COUNT: 'leaderboard:badge_count',
};

// 排行榜缓存有效期 (秒)
const LEADERBOARD_TTL = 3600; // 1小时

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  // ==================== 公共查询方法 ====================

  /**
   * 获取线路贡献排行榜
   */
  async getRouteContributors(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(LEADERBOARD_KEYS.ROUTE_CONTRIBUTION, limit);
  }

  /**
   * 获取活跃度排行榜 (基于参与活动数)
   */
  async getActiveUsers(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(LEADERBOARD_KEYS.ACTIVITY_COUNT, limit);
  }

  /**
   * 获取里程排行榜
   */
  async getDistanceLeaders(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(LEADERBOARD_KEYS.TOTAL_DISTANCE, limit);
  }

  /**
   * 获取爬升排行榜
   */
  async getElevationLeaders(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(LEADERBOARD_KEYS.TOTAL_ELEVATION, limit);
  }

  /**
   * 获取勋章数量排行榜
   */
  async getBadgeLeaders(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(LEADERBOARD_KEYS.BADGE_COUNT, limit);
  }

  /**
   * 获取用户在各排行榜中的排名
   */
  async getUserRankings(userId: string) {
    const [routeRank, activityRank, distanceRank, elevationRank, badgeRank] =
      await Promise.all([
        this.getUserRankInBoard(LEADERBOARD_KEYS.ROUTE_CONTRIBUTION, userId),
        this.getUserRankInBoard(LEADERBOARD_KEYS.ACTIVITY_COUNT, userId),
        this.getUserRankInBoard(LEADERBOARD_KEYS.TOTAL_DISTANCE, userId),
        this.getUserRankInBoard(LEADERBOARD_KEYS.TOTAL_ELEVATION, userId),
        this.getUserRankInBoard(LEADERBOARD_KEYS.BADGE_COUNT, userId),
      ]);

    return {
      routeContribution: routeRank,
      activityCount: activityRank,
      totalDistance: distanceRank,
      totalElevation: elevationRank,
      badgeCount: badgeRank,
    };
  }

  // ==================== 增量更新方法 ====================

  /**
   * 用户完成活动后更新排行榜
   * 在核销成功后调用
   */
  async onActivityCheckedIn(userId: string, activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { route: { select: { distance: true, elevation: true } } },
    });

    if (!activity?.route) {
      return;
    }

    // 更新活动参与次数
    await this.redisService.zincrby(LEADERBOARD_KEYS.ACTIVITY_COUNT, 1, userId);

    // 更新总里程
    if (activity.route.distance > 0) {
      await this.redisService.zincrby(
        LEADERBOARD_KEYS.TOTAL_DISTANCE,
        activity.route.distance,
        userId,
      );
    }

    // 更新总爬升
    if (activity.route.elevation > 0) {
      await this.redisService.zincrby(
        LEADERBOARD_KEYS.TOTAL_ELEVATION,
        activity.route.elevation,
        userId,
      );
    }

    this.logger.debug(`Leaderboard updated for user ${userId} after check-in`);
  }

  /**
   * 用户创建线路后更新贡献排行榜
   */
  async onRouteCreated(userId: string) {
    await this.redisService.zincrby(LEADERBOARD_KEYS.ROUTE_CONTRIBUTION, 1, userId);
    this.logger.debug(`Route contribution updated for user ${userId}`);
  }

  /**
   * 用户获得勋章后更新排行榜
   */
  async onBadgeEarned(userId: string) {
    await this.redisService.zincrby(LEADERBOARD_KEYS.BADGE_COUNT, 1, userId);
    this.logger.debug(`Badge count updated for user ${userId}`);
  }

  // ==================== 定时任务：全量刷新 ====================

  /**
   * 每小时全量刷新排行榜
   * 确保数据一致性
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshAllLeaderboards() {
    this.logger.log('Starting leaderboard refresh...');

    try {
      await Promise.all([
        this.refreshRouteContributors(),
        this.refreshActiveUsers(),
        this.refreshDistanceLeaders(),
        this.refreshElevationLeaders(),
        this.refreshBadgeLeaders(),
      ]);

      this.logger.log('Leaderboard refresh completed');
    } catch (error) {
      this.logger.error('Leaderboard refresh failed:', error);
    }
  }

  /**
   * 刷新线路贡献排行榜
   */
  private async refreshRouteContributors() {
    const contributors = await this.prisma.route.groupBy({
      by: ['creatorId'],
      _count: { id: true },
      where: { creatorId: { not: null } },
    });

    const client = this.redisService.getClient();
    const key = LEADERBOARD_KEYS.ROUTE_CONTRIBUTION;

    // 使用事务批量更新
    const pipeline = client.pipeline();
    pipeline.del(key);

    for (const c of contributors) {
      if (c.creatorId) {
        pipeline.zadd(key, c._count.id, c.creatorId);
      }
    }

    pipeline.expire(key, LEADERBOARD_TTL * 24); // 24小时过期
    await pipeline.exec();
  }

  /**
   * 刷新活跃度排行榜
   */
  private async refreshActiveUsers() {
    const activeUsers = await this.prisma.enrollment.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { status: EnrollStatus.CHECKED_IN },
    });

    const client = this.redisService.getClient();
    const key = LEADERBOARD_KEYS.ACTIVITY_COUNT;

    const pipeline = client.pipeline();
    pipeline.del(key);

    for (const a of activeUsers) {
      pipeline.zadd(key, a._count.id, a.userId);
    }

    pipeline.expire(key, LEADERBOARD_TTL * 24);
    await pipeline.exec();
  }

  /**
   * 刷新里程排行榜
   */
  private async refreshDistanceLeaders() {
    // 使用数据库聚合计算每个用户的总里程
    const result = await this.prisma.$queryRaw<
      Array<{ userId: string; totalDistance: number }>
    >`
      SELECT e."userId", SUM(r.distance) as "totalDistance"
      FROM "Enrollment" e
      JOIN "Activity" a ON e."activityId" = a.id
      JOIN "Route" r ON a."routeId" = r.id
      WHERE e.status = 'CHECKED_IN'
      GROUP BY e."userId"
    `;

    const client = this.redisService.getClient();
    const key = LEADERBOARD_KEYS.TOTAL_DISTANCE;

    const pipeline = client.pipeline();
    pipeline.del(key);

    for (const row of result) {
      const distance = Number(row.totalDistance) || 0;
      if (distance > 0) {
        pipeline.zadd(key, distance, row.userId);
      }
    }

    pipeline.expire(key, LEADERBOARD_TTL * 24);
    await pipeline.exec();
  }

  /**
   * 刷新爬升排行榜
   */
  private async refreshElevationLeaders() {
    const result = await this.prisma.$queryRaw<
      Array<{ userId: string; totalElevation: number }>
    >`
      SELECT e."userId", SUM(r.elevation) as "totalElevation"
      FROM "Enrollment" e
      JOIN "Activity" a ON e."activityId" = a.id
      JOIN "Route" r ON a."routeId" = r.id
      WHERE e.status = 'CHECKED_IN'
      GROUP BY e."userId"
    `;

    const client = this.redisService.getClient();
    const key = LEADERBOARD_KEYS.TOTAL_ELEVATION;

    const pipeline = client.pipeline();
    pipeline.del(key);

    for (const row of result) {
      const elevation = Number(row.totalElevation) || 0;
      if (elevation > 0) {
        pipeline.zadd(key, elevation, row.userId);
      }
    }

    pipeline.expire(key, LEADERBOARD_TTL * 24);
    await pipeline.exec();
  }

  /**
   * 刷新勋章排行榜
   */
  private async refreshBadgeLeaders() {
    const badgeCounts = await this.prisma.userBadge.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    const client = this.redisService.getClient();
    const key = LEADERBOARD_KEYS.BADGE_COUNT;

    const pipeline = client.pipeline();
    pipeline.del(key);

    for (const b of badgeCounts) {
      pipeline.zadd(key, b._count.id, b.userId);
    }

    pipeline.expire(key, LEADERBOARD_TTL * 24);
    await pipeline.exec();
  }

  // ==================== 私有方法 ====================

  /**
   * 从 Redis 获取排行榜数据
   */
  private async getLeaderboard(key: string, limit: number): Promise<LeaderboardEntry[]> {
    // 从 Redis 获取排行数据
    const entries = await this.redisService.zrevrangeWithScores(key, 0, limit - 1);

    if (entries.length === 0) {
      // 如果 Redis 没有数据，触发刷新
      await this.triggerRefreshForKey(key);
      // 重新获取
      const refreshedEntries = await this.redisService.zrevrangeWithScores(key, 0, limit - 1);
      if (refreshedEntries.length === 0) {
        return [];
      }
      return this.enrichWithUserInfo(refreshedEntries);
    }

    return this.enrichWithUserInfo(entries);
  }

  /**
   * 为排行榜条目添加用户信息
   */
  private async enrichWithUserInfo(
    entries: Array<{ member: string; score: number }>,
  ): Promise<LeaderboardEntry[]> {
    const userIds = entries.map((e) => e.member);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, avatarUrl: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return entries.map((entry, index) => {
      const user = userMap.get(entry.member);
      return {
        rank: index + 1,
        userId: entry.member,
        nickname: user?.nickname || '匿名用户',
        avatarUrl: user?.avatarUrl || null,
        value: Math.round(entry.score * 10) / 10, // 保留一位小数
      };
    });
  }

  /**
   * 获取用户在指定排行榜中的排名
   */
  private async getUserRankInBoard(
    key: string,
    userId: string,
  ): Promise<{ rank: number; value: number } | null> {
    const [rank, score] = await Promise.all([
      this.redisService.zrank(key, userId),
      this.redisService.zscore(key, userId),
    ]);

    if (rank === null || score === null) {
      return null;
    }

    return {
      rank: rank + 1, // Redis 排名从 0 开始
      value: Math.round(parseFloat(score) * 10) / 10,
    };
  }

  /**
   * 根据键名触发对应的刷新
   */
  private async triggerRefreshForKey(key: string) {
    switch (key) {
      case LEADERBOARD_KEYS.ROUTE_CONTRIBUTION:
        await this.refreshRouteContributors();
        break;
      case LEADERBOARD_KEYS.ACTIVITY_COUNT:
        await this.refreshActiveUsers();
        break;
      case LEADERBOARD_KEYS.TOTAL_DISTANCE:
        await this.refreshDistanceLeaders();
        break;
      case LEADERBOARD_KEYS.TOTAL_ELEVATION:
        await this.refreshElevationLeaders();
        break;
      case LEADERBOARD_KEYS.BADGE_COUNT:
        await this.refreshBadgeLeaders();
        break;
    }
  }
}
