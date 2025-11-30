import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AchievementService } from './achievement.service';

/**
 * 成就监听器
 * 监听各种事件并触发勋章检查
 */
@Injectable()
export class AchievementListener {
  constructor(private achievementService: AchievementService) {}

  /**
   * 监听用户签到事件
   */
  @OnEvent('enrollment.checked_in')
  async handleCheckIn(payload: {
    userId: string;
    activityId: string;
    startTime?: Date;
    isNightActivity?: boolean;
  }) {
    const { userId, startTime, isNightActivity } = payload;

    const eventData: Record<string, any> = {};
    if (startTime) {
      eventData.startHour = startTime.getHours();
    }
    if (isNightActivity !== undefined) {
      eventData.isNightActivity = isNightActivity;
    }

    const awarded = await this.achievementService.checkAchievementsByEvent(
      userId,
      'enrollment.checked_in',
      eventData,
    );

    if (awarded.length > 0) {
      console.log(
        `🏅 用户 ${userId} 签到后获得勋章: ${awarded.join(', ')}`,
      );
    }
  }

  /**
   * 监听活动完成事件
   */
  @OnEvent('activity.completed')
  async handleActivityCompleted(payload: {
    activityId: string;
    leaderId: string;
    participantIds: string[];
  }) {
    const { leaderId, participantIds } = payload;

    // 检查领队勋章
    const leaderAwarded = await this.achievementService.checkAchievementsByEvent(
      leaderId,
      'activity.completed',
    );

    if (leaderAwarded.length > 0) {
      console.log(
        `🏅 领队 ${leaderId} 活动完成后获得勋章: ${leaderAwarded.join(', ')}`,
      );
    }

    // 检查所有参与者勋章
    for (const participantId of participantIds) {
      const awarded = await this.achievementService.checkAchievementsByEvent(
        participantId,
        'activity.completed',
      );

      if (awarded.length > 0) {
        console.log(
          `🏅 用户 ${participantId} 活动完成后获得勋章: ${awarded.join(', ')}`,
        );
      }
    }
  }

  /**
   * 监听帖子创建事件
   */
  @OnEvent('post.created')
  async handlePostCreated(payload: { userId: string; postId: string }) {
    const { userId } = payload;

    const awarded = await this.achievementService.checkAchievementsByEvent(
      userId,
      'post.created',
    );

    if (awarded.length > 0) {
      console.log(
        `🏅 用户 ${userId} 发帖后获得勋章: ${awarded.join(', ')}`,
      );
    }
  }

  /**
   * 监听线路创建事件
   */
  @OnEvent('route.created')
  async handleRouteCreated(payload: { userId: string; routeId: string }) {
    const { userId } = payload;

    const awarded = await this.achievementService.checkAchievementsByEvent(
      userId,
      'route.created',
    );

    if (awarded.length > 0) {
      console.log(
        `🏅 用户 ${userId} 贡献线路后获得勋章: ${awarded.join(', ')}`,
      );
    }
  }

  /**
   * 监听关注事件
   */
  @OnEvent('follow.created')
  async handleFollowCreated(payload: {
    followerId: string;
    followingId: string;
  }) {
    const { followingId } = payload;

    // 检查被关注者的粉丝数勋章
    const awarded = await this.achievementService.checkAchievementsByEvent(
      followingId,
      'follow.created',
    );

    if (awarded.length > 0) {
      console.log(
        `🏅 用户 ${followingId} 获得新粉丝后获得勋章: ${awarded.join(', ')}`,
      );
    }
  }

  /**
   * 监听领队认证事件
   */
  @OnEvent('leader.certified')
  async handleLeaderCertified(payload: { userId: string }) {
    const { userId } = payload;

    const awarded = await this.achievementService.checkAchievementsByEvent(
      userId,
      'leader.certified',
    );

    if (awarded.length > 0) {
      console.log(
        `🏅 用户 ${userId} 成为领队后获得勋章: ${awarded.join(', ')}`,
      );
    }
  }
}
