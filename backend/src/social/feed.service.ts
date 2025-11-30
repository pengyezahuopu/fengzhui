import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FollowService } from './follow.service';

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private followService: FollowService,
  ) {}

  /**
   * 获取个人 Feed (关注的人的动态)
   */
  async getPersonalFeed(userId: string, cursor?: string, limit = 20) {
    // 获取关注的用户列表
    const followingIds = await this.followService.getFollowingIds(userId);

    // 如果没有关注任何人，返回空列表
    if (followingIds.length === 0) {
      return {
        posts: [],
        nextCursor: null,
      };
    }

    // 查询关注用户的帖子
    const posts = await this.prisma.post.findMany({
      where: {
        userId: { in: followingIds },
      },
      take: limit,
      skip: cursor ? 1 : 0,
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
        circle: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    return {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
    };
  }

  /**
   * 获取推荐 Feed (热门帖子)
   */
  async getRecommendFeed(cursor?: string, limit = 20) {
    // 简单实现：按照浏览量和点赞数排序
    // TODO: 可以用更复杂的推荐算法
    const posts = await this.prisma.post.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { viewCount: 'desc' },
        { createdAt: 'desc' },
      ],
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
        circle: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    return {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
    };
  }

  /**
   * 获取圈子 Feed
   */
  async getCircleFeed(circleId: string, cursor?: string, limit = 20) {
    const posts = await this.prisma.post.findMany({
      where: { circleId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { isTop: 'desc' }, // 置顶帖子优先
        { createdAt: 'desc' },
      ],
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
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    return {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
    };
  }

  /**
   * 获取用户动态 (用于个人主页)
   */
  async getUserFeed(userId: string, cursor?: string, limit = 20) {
    const posts = await this.prisma.post.findMany({
      where: { userId },
      take: limit,
      skip: cursor ? 1 : 0,
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
        circle: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    return {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
    };
  }
}
