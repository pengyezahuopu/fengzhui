import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  content?: string;
  targetId?: string;
  targetType?: string;
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建通知
   */
  async createNotification(
    userId: string,
    dto: CreateNotificationDto,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });
  }

  /**
   * 批量创建通知
   */
  async createNotifications(
    userIds: string[],
    dto: CreateNotificationDto,
  ): Promise<void> {
    if (userIds.length === 0) return;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        targetId: dto.targetId,
        targetType: dto.targetType,
      })),
    });
  }

  /**
   * 获取通知列表
   */
  async getNotifications(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      unreadOnly?: boolean;
    } = {},
  ) {
    const { cursor, limit = 20, unreadOnly = false } = options;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return {
      notifications: items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * 标记单个通知为已读
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return false;
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return true;
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return result.count;
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * 删除通知
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<boolean> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return false;
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return true;
  }

  /**
   * 清空所有已读通知
   */
  async clearReadNotifications(userId: string): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });

    return result.count;
  }

  // ==================== 便捷通知方法 ====================

  /**
   * 发送点赞通知
   */
  async notifyLike(
    targetUserId: string,
    likerName: string,
    postId: string,
  ): Promise<void> {
    await this.createNotification(targetUserId, {
      type: NotificationType.LIKE,
      title: `${likerName} 赞了你的帖子`,
      targetId: postId,
      targetType: 'post',
    });
  }

  /**
   * 发送评论通知
   */
  async notifyComment(
    targetUserId: string,
    commenterName: string,
    postId: string,
    commentContent: string,
  ): Promise<void> {
    await this.createNotification(targetUserId, {
      type: NotificationType.COMMENT,
      title: `${commenterName} 评论了你的帖子`,
      content: commentContent.substring(0, 100),
      targetId: postId,
      targetType: 'post',
    });
  }

  /**
   * 发送关注通知
   */
  async notifyFollow(
    targetUserId: string,
    followerName: string,
    followerId: string,
  ): Promise<void> {
    await this.createNotification(targetUserId, {
      type: NotificationType.FOLLOW,
      title: `${followerName} 关注了你`,
      targetId: followerId,
      targetType: 'user',
    });
  }

  /**
   * 发送勋章获得通知
   */
  async notifyBadge(
    userId: string,
    badgeName: string,
    badgeIcon: string,
    badgeId: string,
  ): Promise<void> {
    await this.createNotification(userId, {
      type: NotificationType.BADGE,
      title: `恭喜获得勋章: ${badgeIcon} ${badgeName}`,
      targetId: badgeId,
      targetType: 'badge',
    });
  }

  /**
   * 发送活动通知
   */
  async notifyActivity(
    userId: string,
    title: string,
    activityId: string,
    content?: string,
  ): Promise<void> {
    await this.createNotification(userId, {
      type: NotificationType.ACTIVITY,
      title,
      content,
      targetId: activityId,
      targetType: 'activity',
    });
  }

  /**
   * 发送系统通知
   */
  async notifySystem(
    userId: string,
    title: string,
    content?: string,
  ): Promise<void> {
    await this.createNotification(userId, {
      type: NotificationType.SYSTEM,
      title,
      content,
    });
  }
}
