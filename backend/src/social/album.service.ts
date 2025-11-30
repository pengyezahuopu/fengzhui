import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnrollStatus } from '@prisma/client';

interface UploadPhotoDto {
  url: string;
  description?: string;
}

@Injectable()
export class AlbumService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 上传照片到活动相册
   */
  async uploadPhoto(activityId: string, userId: string, dto: UploadPhotoDto) {
    // 检查活动是否存在
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        enrollments: {
          where: { userId },
          select: { id: true, status: true },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 检查用户是否有权限上传（活动发起人或已报名参与者）
    const isLeader = activity.leaderId === userId;
    const enrollment = activity.enrollments[0];
    const isParticipant = enrollment && (enrollment.status === EnrollStatus.PAID || enrollment.status === EnrollStatus.CHECKED_IN);

    if (!isLeader && !isParticipant) {
      throw new ForbiddenException('只有活动参与者可以上传照片');
    }

    // 创建照片记录
    const photo = await this.prisma.activityPhoto.create({
      data: {
        activityId,
        userId,
        url: dto.url,
        description: dto.description,
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });

    return photo;
  }

  /**
   * 获取活动相册
   */
  async getPhotos(activityId: string, options: {
    cursor?: string;
    limit?: number;
    featuredOnly?: boolean;
  }) {
    const { cursor, limit = 20, featuredOnly = false } = options;

    const where: any = { activityId };
    if (featuredOnly) {
      where.isFeatured = true;
    }

    const photos = await this.prisma.activityPhoto.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });

    const hasMore = photos.length > limit;
    const data = hasMore ? photos.slice(0, -1) : photos;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    // 获取相册统计
    const stats = await this.prisma.activityPhoto.aggregate({
      where: { activityId },
      _count: true,
    });

    return {
      photos: data,
      nextCursor,
      totalCount: stats._count,
    };
  }

  /**
   * 删除照片
   */
  async deletePhoto(photoId: string, userId: string) {
    const photo = await this.prisma.activityPhoto.findUnique({
      where: { id: photoId },
      include: {
        activity: {
          select: { leaderId: true },
        },
      },
    });

    if (!photo) {
      throw new NotFoundException('照片不存在');
    }

    // 检查权限（照片上传者或活动发起人可以删除）
    const isOwner = photo.userId === userId;
    const isLeader = photo.activity.leaderId === userId;

    if (!isOwner && !isLeader) {
      throw new ForbiddenException('无权删除该照片');
    }

    // 删除照片记录
    await this.prisma.activityPhoto.delete({
      where: { id: photoId },
    });

    // 触发 OSS 清理事件
    this.eventEmitter.emit('oss.cleanup', {
      type: 'activity_photo',
      urls: [photo.url],
    });

    return { success: true };
  }

  /**
   * 设置精选照片
   */
  async featurePhoto(photoId: string, userId: string, featured: boolean) {
    const photo = await this.prisma.activityPhoto.findUnique({
      where: { id: photoId },
      include: {
        activity: {
          select: { leaderId: true },
        },
      },
    });

    if (!photo) {
      throw new NotFoundException('照片不存在');
    }

    // 只有活动发起人可以设置精选
    if (photo.activity.leaderId !== userId) {
      throw new ForbiddenException('只有活动发起人可以设置精选');
    }

    return this.prisma.activityPhoto.update({
      where: { id: photoId },
      data: { isFeatured: featured },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * 获取用户在某活动的照片
   */
  async getUserPhotosInActivity(activityId: string, userId: string) {
    return this.prisma.activityPhoto.findMany({
      where: { activityId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取活动相册统计
   */
  async getAlbumStats(activityId: string) {
    const [totalCount, featuredCount, contributorCount] = await Promise.all([
      this.prisma.activityPhoto.count({ where: { activityId } }),
      this.prisma.activityPhoto.count({ where: { activityId, isFeatured: true } }),
      this.prisma.activityPhoto.groupBy({
        by: ['userId'],
        where: { activityId },
        _count: true,
      }),
    ]);

    return {
      totalCount,
      featuredCount,
      contributorCount: contributorCount.length,
    };
  }
}
