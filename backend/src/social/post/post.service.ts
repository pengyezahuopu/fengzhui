import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async createPost(data: {
    userId: string;
    content: string;
    imageUrls?: string[];
    tags?: string[];
    activityId?: string;
    routeId?: string;
  }) {
    const { userId, content, imageUrls, tags, activityId, routeId } = data;

    return this.prisma.post.create({
      data: {
        userId,
        content,
        tags: tags || [],
        activityId,
        routeId,
        images: {
          create: imageUrls?.map((url, index) => ({
            url,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: true,
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });
  }

  async getPosts(params: {
    userId?: string;
    cursor?: string;
    take?: number;
  }) {
    const { cursor, take = 10 } = params;
    
    return this.prisma.post.findMany({
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });
  }

  async likePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    try {
      return await this.prisma.postLike.create({
        data: { postId, userId },
      });
    } catch (e) {
      // Prisma error P2002: Unique constraint failed
      throw new ConflictException('Already liked');
    }
  }

  async unlikePost(postId: string, userId: string) {
    try {
      return await this.prisma.postLike.delete({
        where: {
          postId_userId: { postId, userId },
        },
      });
    } catch (e) {
      throw new NotFoundException('Like not found');
    }
  }
}
