import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CommentService } from './comment.service';
import { FollowService } from './follow.service';
import { FeedService } from './feed.service';
import { CircleService } from './circle.service';
import { AlbumService } from './album.service';
import { NotificationService } from './notification.service';
import { AchievementService } from './achievement.service';
import { LeaderboardService } from './leaderboard.service';
import { CreatePostDto, CreateCommentDto, QueryPostsDto } from './dto/create-post.dto';
import { CircleCategory, BadgeCategory } from '@prisma/client';

@Controller()
export class SocialController {
  constructor(
    private postService: PostService,
    private commentService: CommentService,
    private followService: FollowService,
    private feedService: FeedService,
    private circleService: CircleService,
    private albumService: AlbumService,
    private notificationService: NotificationService,
    private achievementService: AchievementService,
    private leaderboardService: LeaderboardService,
  ) {}

  // ==================== Posts ====================

  @Post('posts')
  async createPost(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postService.createPost(userId, dto);
  }

  @Get('posts')
  async getPosts(@Query() query: QueryPostsDto) {
    return this.postService.getPosts(query);
  }

  @Get('posts/:id')
  async getPostById(@Param('id') id: string) {
    return this.postService.getPostById(id);
  }

  @Delete('posts/:id')
  async deletePost(
    @Headers('x-user-id') userId: string,
    @Param('id') postId: string,
  ) {
    return this.postService.deletePost(userId, postId);
  }

  @Post('posts/:id/like')
  async likePost(
    @Headers('x-user-id') userId: string,
    @Param('id') postId: string,
  ) {
    return this.postService.likePost(userId, postId);
  }

  @Delete('posts/:id/like')
  async unlikePost(
    @Headers('x-user-id') userId: string,
    @Param('id') postId: string,
  ) {
    return this.postService.unlikePost(userId, postId);
  }

  // ==================== Comments ====================

  @Post('posts/:postId/comments')
  async createComment(
    @Headers('x-user-id') userId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.createComment(userId, postId, dto);
  }

  @Get('posts/:postId/comments')
  async getComments(
    @Param('postId') postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.commentService.getComments(postId, cursor, limit);
  }

  @Get('comments/:id/replies')
  async getCommentReplies(
    @Param('id') commentId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.commentService.getCommentReplies(commentId, cursor, limit);
  }

  @Delete('comments/:id')
  async deleteComment(
    @Headers('x-user-id') userId: string,
    @Param('id') commentId: string,
  ) {
    return this.commentService.deleteComment(userId, commentId);
  }

  @Post('comments/:id/like')
  async likeComment(
    @Headers('x-user-id') userId: string,
    @Param('id') commentId: string,
  ) {
    return this.commentService.likeComment(userId, commentId);
  }

  @Delete('comments/:id/like')
  async unlikeComment(
    @Headers('x-user-id') userId: string,
    @Param('id') commentId: string,
  ) {
    return this.commentService.unlikeComment(userId, commentId);
  }

  // ==================== Follow ====================

  @Post('users/:id/follow')
  async followUser(
    @Headers('x-user-id') followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.followService.follow(followerId, followingId);
  }

  @Delete('users/:id/follow')
  async unfollowUser(
    @Headers('x-user-id') followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.followService.unfollow(followerId, followingId);
  }

  @Get('users/:id/followers')
  async getFollowers(
    @Param('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.followService.getFollowers(userId, cursor, limit);
  }

  @Get('users/:id/following')
  async getFollowing(
    @Param('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.followService.getFollowing(userId, cursor, limit);
  }

  @Get('users/:id/follow-stats')
  async getFollowStats(@Param('id') userId: string) {
    return this.followService.getFollowStats(userId);
  }

  // ==================== Feed ====================

  @Get('feed')
  async getPersonalFeed(
    @Headers('x-user-id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.feedService.getPersonalFeed(userId, cursor, limit);
  }

  @Get('feed/recommend')
  async getRecommendFeed(
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.feedService.getRecommendFeed(cursor, limit);
  }

  @Get('feed/circle/:circleId')
  async getCircleFeed(
    @Param('circleId') circleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.feedService.getCircleFeed(circleId, cursor, limit);
  }

  @Get('feed/user/:userId')
  async getUserFeed(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.feedService.getUserFeed(userId, cursor, limit);
  }

  // ==================== Circles ====================

  @Post('circles')
  async createCircle(
    @Headers('x-user-id') userId: string,
    @Body() dto: {
      name: string;
      description?: string;
      icon?: string;
      coverUrl?: string;
      category?: CircleCategory;
      clubId?: string;
    },
  ) {
    return this.circleService.createCircle(userId, dto);
  }

  @Get('circles')
  async getCircles(
    @Query('category') category?: CircleCategory,
    @Query('keyword') keyword?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.circleService.getCircles({ category, keyword, cursor, limit });
  }

  @Get('circles/:id')
  async getCircleById(
    @Param('id') circleId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.circleService.getCircleById(circleId, userId);
  }

  @Patch('circles/:id')
  async updateCircle(
    @Headers('x-user-id') userId: string,
    @Param('id') circleId: string,
    @Body() dto: {
      name?: string;
      description?: string;
      icon?: string;
      coverUrl?: string;
    },
  ) {
    return this.circleService.updateCircle(circleId, userId, dto);
  }

  @Post('circles/:id/join')
  async joinCircle(
    @Headers('x-user-id') userId: string,
    @Param('id') circleId: string,
  ) {
    return this.circleService.joinCircle(circleId, userId);
  }

  @Delete('circles/:id/join')
  async leaveCircle(
    @Headers('x-user-id') userId: string,
    @Param('id') circleId: string,
  ) {
    return this.circleService.leaveCircle(circleId, userId);
  }

  @Get('circles/:id/posts')
  async getCirclePosts(
    @Param('id') circleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.circleService.getCirclePosts(circleId, { cursor, limit });
  }

  @Get('circles/:id/members')
  async getCircleMembers(
    @Param('id') circleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.circleService.getCircleMembers(circleId, { cursor, limit });
  }

  @Get('my/circles')
  async getMyCircles(
    @Headers('x-user-id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.circleService.getUserCircles(userId, { cursor, limit });
  }

  // ==================== Activity Albums ====================

  @Post('activities/:activityId/photos')
  async uploadPhoto(
    @Headers('x-user-id') userId: string,
    @Param('activityId') activityId: string,
    @Body() dto: { url: string; description?: string },
  ) {
    return this.albumService.uploadPhoto(activityId, userId, dto);
  }

  @Get('activities/:activityId/photos')
  async getPhotos(
    @Param('activityId') activityId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('featuredOnly') featuredOnly?: string,
  ) {
    return this.albumService.getPhotos(activityId, {
      cursor,
      limit,
      featuredOnly: featuredOnly === 'true',
    });
  }

  @Delete('photos/:id')
  async deletePhoto(
    @Headers('x-user-id') userId: string,
    @Param('id') photoId: string,
  ) {
    return this.albumService.deletePhoto(photoId, userId);
  }

  @Patch('photos/:id/feature')
  async featurePhoto(
    @Headers('x-user-id') userId: string,
    @Param('id') photoId: string,
    @Body() dto: { featured: boolean },
  ) {
    return this.albumService.featurePhoto(photoId, userId, dto.featured);
  }

  @Get('activities/:activityId/album-stats')
  async getAlbumStats(@Param('activityId') activityId: string) {
    return this.albumService.getAlbumStats(activityId);
  }

  // ==================== Notifications ====================

  @Get('notifications')
  async getNotifications(
    @Headers('x-user-id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.getNotifications(userId, {
      cursor,
      limit,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Headers('x-user-id') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch('notifications/:id/read')
  async markAsRead(
    @Headers('x-user-id') userId: string,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationService.markAsRead(
      notificationId,
      userId,
    );
    return { success };
  }

  @Patch('notifications/read-all')
  async markAllAsRead(@Headers('x-user-id') userId: string) {
    const count = await this.notificationService.markAllAsRead(userId);
    return { count };
  }

  @Delete('notifications/:id')
  async deleteNotification(
    @Headers('x-user-id') userId: string,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationService.deleteNotification(
      notificationId,
      userId,
    );
    return { success };
  }

  @Delete('notifications/clear-read')
  async clearReadNotifications(@Headers('x-user-id') userId: string) {
    const count = await this.notificationService.clearReadNotifications(userId);
    return { count };
  }

  // ==================== Badges & Achievements ====================

  @Get('badges')
  async getBadges(@Query('category') category?: BadgeCategory) {
    return this.achievementService.getBadges(category);
  }

  @Get('badges/wall')
  async getBadgeWall(@Headers('x-user-id') userId: string) {
    return this.achievementService.getBadgeWall(userId);
  }

  @Get('users/:userId/badges')
  async getUserBadges(@Param('userId') userId: string) {
    return this.achievementService.getUserBadges(userId);
  }

  @Post('achievements/check')
  async checkAchievements(@Headers('x-user-id') userId: string) {
    const awarded = await this.achievementService.checkAchievements(userId);
    return { awarded };
  }

  // ==================== Leaderboards ====================

  @Get('leaderboard/contributors')
  async getRouteContributors(@Query('limit') limit?: number) {
    return this.leaderboardService.getRouteContributors(limit);
  }

  @Get('leaderboard/active')
  async getActiveUsers(@Query('limit') limit?: number) {
    return this.leaderboardService.getActiveUsers(limit);
  }

  @Get('leaderboard/distance')
  async getDistanceLeaders(@Query('limit') limit?: number) {
    return this.leaderboardService.getDistanceLeaders(limit);
  }

  @Get('leaderboard/elevation')
  async getElevationLeaders(@Query('limit') limit?: number) {
    return this.leaderboardService.getElevationLeaders(limit);
  }

  @Get('leaderboard/badges')
  async getBadgeLeaders(@Query('limit') limit?: number) {
    return this.leaderboardService.getBadgeLeaders(limit);
  }

  @Get('leaderboard/my-rankings')
  async getMyRankings(@Headers('x-user-id') userId: string) {
    return this.leaderboardService.getUserRankings(userId);
  }
}
