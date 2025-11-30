import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContentSecurityService } from '../common/content-security';
import { CreatePostDto, QueryPostsDto } from './dto/create-post.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PostService {
  constructor(
    private prisma: PrismaService,
    private contentSecurity: ContentSecurityService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建帖子
   */
  async createPost(userId: string, dto: CreatePostDto) {
    // 1. 内容安全检测
    await this.contentSecurity.validateContent(dto.content);

    // 2. 创建帖子和图片
    const post = await this.prisma.post.create({
      data: {
        userId,
        content: dto.content,
        activityId: dto.activityId,
        routeId: dto.routeId,
        circleId: dto.circleId,
        tags: dto.tags || [],
        images: dto.imageUrls
          ? {
              create: dto.imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        images: true,
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

    // 3. 更新圈子帖子数
    if (dto.circleId) {
      await this.prisma.circle.update({
        where: { id: dto.circleId },
        data: { postCount: { increment: 1 } },
      });
    }

    // 4. 发送事件 (用于成就系统)
    this.eventEmitter.emit('post.created', { userId, postId: post.id });

    return post;
  }

  /**
   * 获取帖子列表 (支持分页)
   */
  async getPosts(query: QueryPostsDto) {
    const { userId, circleId, cursor } = query;
    // 强制数值化并加上边界，避免 Prisma 验证错误导致 500
    const limitNum = (() => {
      const n = Number((query as any)?.limit ?? 20);
      if (Number.isNaN(n)) return 20;
      return Math.min(100, Math.max(1, n));
    })();

    const where: any = {};
    if (userId) where.userId = userId;
    if (circleId) where.circleId = circleId;

    const posts = await this.prisma.post.findMany({
      where,
      take: limitNum,
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
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    return {
      posts,
      nextCursor: posts.length === limitNum ? posts[posts.length - 1].id : null,
    };
  }

  /**
   * 获取帖子详情
   */
  async getPostById(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        activity: {
          select: { id: true, title: true, coverUrl: true },
        },
        route: {
          select: { id: true, name: true, coverUrl: true },
        },
        circle: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    // 增加浏览量
    await this.prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    return post;
  }

  /**
   * 删除帖子
   */
  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });

    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('无权删除此帖子');
    }

    // 删除帖子 (图片会级联删除)
    await this.prisma.post.delete({ where: { id: postId } });

    // 更新圈子帖子数
    if (post.circleId) {
      await this.prisma.circle.update({
        where: { id: post.circleId },
        data: { postCount: { decrement: 1 } },
      });
    }

    // 发送 OSS 清理事件 (P2 任务)
    if (post.images.length > 0) {
      this.eventEmitter.emit('oss.cleanup', {
        urls: post.images.map((img) => img.url),
      });
    }

    return { success: true };
  }

  /**
   * 点赞帖子
   */
  async likePost(userId: string, postId: string) {
    // 检查帖子是否存在
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    // 创建点赞 (如果已存在则忽略)
    await this.prisma.postLike.upsert({
      where: {
        postId_userId: { postId, userId },
      },
      create: { postId, userId },
      update: {},
    });

    // 发送通知 (如果不是自己的帖子)
    if (post.userId !== userId) {
      this.eventEmitter.emit('notification.create', {
        userId: post.userId,
        type: 'LIKE',
        title: '有人赞了你的动态',
        targetId: postId,
        targetType: 'Post',
      });
    }

    return { success: true };
  }

  /**
   * 取消点赞
   */
  async unlikePost(userId: string, postId: string) {
    await this.prisma.postLike.deleteMany({
      where: { postId, userId },
    });

    return { success: true };
  }

  /**
   * 检查用户是否已点赞
   */
  async isLiked(userId: string, postId: string): Promise<boolean> {
    const like = await this.prisma.postLike.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });
    return !!like;
  }

  /**
   * 批量检查点赞状态
   */
  async batchCheckLiked(
    userId: string,
    postIds: string[],
  ): Promise<Record<string, boolean>> {
    const likes = await this.prisma.postLike.findMany({
      where: {
        userId,
        postId: { in: postIds },
      },
      select: { postId: true },
    });

    const likedSet = new Set(likes.map((l) => l.postId));
    const result: Record<string, boolean> = {};
    for (const id of postIds) {
      result[id] = likedSet.has(id);
    }
    return result;
  }
}
