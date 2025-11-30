import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ContentSecurityService } from '../common/content-security';
import { CreateCommentDto } from './dto/create-post.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private contentSecurity: ContentSecurityService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建评论
   */
  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    // 1. 内容安全检测
    await this.contentSecurity.validateContent(dto.content);

    // 2. 检查帖子是否存在
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    // 3. 如果是回复评论，检查父评论是否存在
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException('父评论不存在或不属于此帖子');
      }
    }

    // 4. 创建评论
    const comment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        content: dto.content,
        parentId: dto.parentId,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        parent: {
          select: {
            id: true,
            user: {
              select: { id: true, nickname: true },
            },
          },
        },
      },
    });

    // 5. 发送通知
    if (post.userId !== userId) {
      this.eventEmitter.emit('notification.create', {
        userId: post.userId,
        type: 'COMMENT',
        title: '有人评论了你的动态',
        content: dto.content.substring(0, 50),
        targetId: postId,
        targetType: 'Post',
      });
    }

    // 6. 如果是回复，也通知被回复的人
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { userId: true },
      });
      if (parentComment && parentComment.userId !== userId) {
        this.eventEmitter.emit('notification.create', {
          userId: parentComment.userId,
          type: 'COMMENT',
          title: '有人回复了你的评论',
          content: dto.content.substring(0, 50),
          targetId: postId,
          targetType: 'Post',
        });
      }
    }

    return comment;
  }

  /**
   * 获取帖子评论列表
   */
  async getComments(postId: string, cursor?: string, limit = 20) {
    const limitNum = Math.min(100, Math.max(1, Number(limit ?? 20)));
    // 获取一级评论
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // 只获取一级评论
      },
      take: limitNum,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        replies: {
          take: 3, // 只取前3条回复
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, nickname: true, avatarUrl: true },
            },
            parent: {
              select: {
                user: {
                  select: { id: true, nickname: true },
                },
              },
            },
          },
        },
        _count: {
          select: { replies: true, likes: true },
        },
      },
    });

    return {
      comments,
      nextCursor:
        comments.length === limitNum ? comments[comments.length - 1].id : null,
    };
  }

  /**
   * 获取评论的更多回复
   */
  async getCommentReplies(commentId: string, cursor?: string, limit = 20) {
    const limitNum = Math.min(100, Math.max(1, Number(limit ?? 20)));
    const replies = await this.prisma.comment.findMany({
      where: { parentId: commentId },
      take: limitNum,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        parent: {
          select: {
            user: {
              select: { id: true, nickname: true },
            },
          },
        },
        _count: {
          select: { likes: true },
        },
      },
    });

    return {
      replies,
      nextCursor:
        replies.length === limitNum ? replies[replies.length - 1].id : null,
    };
  }

  /**
   * 删除评论
   */
  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('无权删除此评论');
    }

    // 删除评论 (回复会级联删除)
    await this.prisma.comment.delete({ where: { id: commentId } });

    return { success: true };
  }

  /**
   * 点赞评论
   */
  async likeComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    await this.prisma.commentLike.upsert({
      where: {
        commentId_userId: { commentId, userId },
      },
      create: { commentId, userId },
      update: {},
    });

    return { success: true };
  }

  /**
   * 取消点赞评论
   */
  async unlikeComment(userId: string, commentId: string) {
    await this.prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });

    return { success: true };
  }
}
