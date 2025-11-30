import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class FollowService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 关注用户
   */
  async follow(followerId: string, followingId: string) {
    // 不能关注自己
    if (followerId === followingId) {
      throw new BadRequestException('不能关注自己');
    }

    // 检查目标用户是否存在
    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!targetUser) {
      throw new NotFoundException('用户不存在');
    }

    // 创建关注关系 (如果已存在则忽略)
    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      create: { followerId, followingId },
      update: {},
    });

    // 发送通知
    this.eventEmitter.emit('notification.create', {
      userId: followingId,
      type: 'FOLLOW',
      title: '有人关注了你',
      targetId: followerId,
      targetType: 'User',
    });

    return { success: true };
  }

  /**
   * 取消关注
   */
  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });

    return { success: true };
  }

  /**
   * 检查是否已关注
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });
    return !!follow;
  }

  /**
   * 获取粉丝列表
   */
  async getFollowers(userId: string, cursor?: string, limit = 20) {
    const limitNum = Math.min(100, Math.max(1, Number(limit ?? 20)));
    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      take: limitNum,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            leaderProfile: {
              select: { rating: true },
            },
          },
        },
      },
    });

    return {
      users: follows.map((f) => f.follower),
      nextCursor:
        follows.length === limitNum ? follows[follows.length - 1].id : null,
    };
  }

  /**
   * 获取关注列表
   */
  async getFollowing(userId: string, cursor?: string, limit = 20) {
    const limitNum = Math.min(100, Math.max(1, Number(limit ?? 20)));
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      take: limitNum,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        following: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            leaderProfile: {
              select: { rating: true },
            },
          },
        },
      },
    });

    return {
      users: follows.map((f) => f.following),
      nextCursor:
        follows.length === limitNum ? follows[follows.length - 1].id : null,
    };
  }

  /**
   * 获取关注/粉丝数量统计
   */
  async getFollowStats(userId: string) {
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return { followersCount, followingCount };
  }

  /**
   * 批量检查关注状态
   */
  async batchCheckFollowing(
    followerId: string,
    userIds: string[],
  ): Promise<Record<string, boolean>> {
    const follows = await this.prisma.follow.findMany({
      where: {
        followerId,
        followingId: { in: userIds },
      },
      select: { followingId: true },
    });

    const followingSet = new Set(follows.map((f) => f.followingId));
    const result: Record<string, boolean> = {};
    for (const id of userIds) {
      result[id] = followingSet.has(id);
    }
    return result;
  }

  /**
   * 获取关注的用户ID列表 (用于 Feed)
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return follows.map((f) => f.followingId);
  }
}
