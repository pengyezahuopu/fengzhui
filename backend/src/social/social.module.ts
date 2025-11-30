import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma.module';
import { ContentSecurityModule } from '../common/content-security/content-security.module';
import { SocialController } from './social.controller';
import { PostService } from './post.service';
import { CommentService } from './comment.service';
import { FollowService } from './follow.service';
import { FeedService } from './feed.service';
import { CircleService } from './circle.service';
import { AlbumService } from './album.service';
import { NotificationService } from './notification.service';
import { AchievementService } from './achievement.service';
import { AchievementListener } from './achievement.listener';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot(), ContentSecurityModule],
  controllers: [SocialController],
  providers: [
    PostService,
    CommentService,
    FollowService,
    FeedService,
    CircleService,
    AlbumService,
    NotificationService,
    AchievementService,
    AchievementListener,
    LeaderboardService,
  ],
  exports: [
    PostService,
    CommentService,
    FollowService,
    FeedService,
    CircleService,
    AlbumService,
    NotificationService,
    AchievementService,
    LeaderboardService,
  ],
})
export class SocialModule {}
