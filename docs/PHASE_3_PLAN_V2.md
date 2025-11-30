# 户外运动管理平台 Phase 3 (社区与社交) 优化版开发计划 V2.0

**版本**: 2.0 (优化版)
**更新日期**: 2025-11-29
**周期**: Week 7-9 (3周)
**目标**: 构建"圈层化户外生活方式"社区，实现用户强连接，提升平台留存率与活跃度

---

## 1. 核心功能模块 (重新规划)

### 1.1 帖子/动态系统 (Posts)

**功能描述**:
- 用户发布图文动态 (类似小红书/朋友圈)
- 支持关联已参与的活动、线路、话题标签
- 互动: 点赞、评论、收藏、分享

**技术要点**:
- 多图上传 (最多9张)
- 图片压缩与 CDN 分发
- 评论支持二级嵌套 (回复评论)

### 1.2 活动相册 (Activity Albums) 🆕

**功能描述**:
- 活动完成后 (`status = COMPLETED`)，参与者可上传照片到活动相册
- 相册归属于活动，所有参与者可查看
- 精选照片可置顶展示

**业务规则**:
- 仅 `CHECKED_IN` 状态的报名者可上传
- 活动结束后 7 天内可上传
- 每人每活动最多上传 20 张

### 1.3 圈子系统 (Circles)

**功能描述**:
- 基于职业的圈子: 医生户外群、律师骑行队、教师徒步组
- 基于兴趣的圈子: 摄影党、装备控、亲子游
- 圈子内专属讨论区和活动推荐

**与俱乐部的关系**:
- 俱乐部 (Club) = 活动组织方 (B端)
- 圈子 (Circle) = 用户兴趣社群 (C端)
- 俱乐部可创建官方圈子 (`isOfficial = true`)

### 1.4 用户关系 (Social Graph)

**功能描述**:
- 关注/粉丝机制
- 互相关注自动成为好友
- 查看关注列表、粉丝列表

### 1.5 成就体系 (Achievements)

**勋章定义** (基于战略规划):

| 勋章名称 | 图标 | 获取条件 | 类型 |
|:---|:---|:---|:---|
| 初次远足 | 🥾 | 完成首次活动 | 里程碑 |
| 步道行者 | 🚶 | 累计完成 10 次徒步活动 | 累计型 |
| 高原征服者 | 🏔️ | 完成 5 次海拔 4000m+ 活动 | 挑战型 |
| 雨中漫步 | 🌧️ | 在雨天完成户外活动 | 特殊型 |
| 社交达人 | 💬 | 发布 20 条动态 | 互动型 |
| 探路先锋 | 🗺️ | 上传 5 条优质线路 | 贡献型 |
| 人气领队 | ⭐ | 领队评分 4.8+ 且带队 10 次 | 领队专属 |

**触发机制**:
- 监听 `Enrollment.status` 变更为 `CHECKED_IN`
- 监听 `Activity.status` 变更为 `COMPLETED`
- 定时任务检查累计型成就

### 1.6 贡献者排行榜 🆕

**功能描述**:
- 线路贡献排行 (上传线路数量)
- 本月活跃排行 (发帖数 + 互动数)
- 圈子活跃排行

### 1.7 个人主页升级

**展示内容**:
- 户外履历: 参与活动次数、总里程、累计爬升
- 足迹地图: 基于参与活动的线路聚合
- 勋章墙: 已获得的成就展示
- 动态列表: 用户发布的所有帖子

---

## 2. 数据库设计 (Prisma Schema)

### 2.1 新增模型

```prisma
// ==================== 帖子相关 ====================
model Post {
  id          String      @id @default(uuid())
  userId      String
  content     String
  activityId  String?     // 关联活动 (可选)
  routeId     String?     // 关联线路 (可选)
  circleId    String?     // 发布到圈子 (可选)
  tags        String[]    // 话题标签
  viewCount   Int         @default(0)
  isTop       Boolean     @default(false)  // 置顶
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user        User        @relation(fields: [userId], references: [id])
  activity    Activity?   @relation(fields: [activityId], references: [id])
  route       Route?      @relation(fields: [routeId], references: [id])
  circle      Circle?     @relation(fields: [circleId], references: [id])
  images      PostImage[]
  comments    Comment[]
  likes       PostLike[]

  @@index([userId])
  @@index([circleId])
  @@index([createdAt])
}

model PostImage {
  id        String   @id @default(uuid())
  postId    String
  url       String
  width     Int?
  height    Int?
  sortOrder Int      @default(0)

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
}

model PostLike {
  id        String   @id @default(uuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])

  @@unique([postId, userId])
}

// ==================== 评论相关 ====================
model Comment {
  id        String        @id @default(uuid())
  postId    String
  userId    String
  content   String
  parentId  String?       // 回复的评论ID (二级评论)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  post      Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User          @relation(fields: [userId], references: [id])
  parent    Comment?      @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[]     @relation("CommentReplies")
  likes     CommentLike[]

  @@index([postId])
}

model CommentLike {
  id        String   @id @default(uuid())
  commentId String
  userId    String
  createdAt DateTime @default(now())

  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])

  @@unique([commentId, userId])
}

// ==================== 用户关系 ====================
model Follow {
  id          String   @id @default(uuid())
  followerId  String   // 关注者
  followingId String   // 被关注者
  createdAt   DateTime @default(now())

  follower    User     @relation("Followers", fields: [followerId], references: [id])
  following   User     @relation("Following", fields: [followingId], references: [id])

  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
}

// ==================== 圈子相关 ====================
model Circle {
  id          String         @id @default(uuid())
  name        String
  description String?
  icon        String?
  coverUrl    String?
  category    CircleCategory @default(INTEREST)
  creatorId   String
  clubId      String?        // 关联俱乐部 (官方圈子)
  isOfficial  Boolean        @default(false)
  memberCount Int            @default(0)
  postCount   Int            @default(0)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  creator     User           @relation("CircleCreator", fields: [creatorId], references: [id])
  club        Club?          @relation(fields: [clubId], references: [id])
  members     CircleMember[]
  posts       Post[]

  @@index([category])
}

model CircleMember {
  id       String     @id @default(uuid())
  circleId String
  userId   String
  role     CircleRole @default(MEMBER)
  joinedAt DateTime   @default(now())

  circle   Circle     @relation(fields: [circleId], references: [id], onDelete: Cascade)
  user     User       @relation(fields: [userId], references: [id])

  @@unique([circleId, userId])
}

// ==================== 活动相册 (新增) ====================
model ActivityPhoto {
  id          String   @id @default(uuid())
  activityId  String
  userId      String
  url         String
  description String?
  isFeatured  Boolean  @default(false)  // 精选
  createdAt   DateTime @default(now())

  activity    Activity @relation(fields: [activityId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@index([activityId])
}

// ==================== 成就系统 ====================
model Badge {
  id          String      @id @default(uuid())
  name        String      @unique
  icon        String
  description String
  category    BadgeCategory
  criteria    Json        // 触发条件 (JSON格式存储)
  sortOrder   Int         @default(0)

  userBadges  UserBadge[]
}

model UserBadge {
  id        String   @id @default(uuid())
  userId    String
  badgeId   String
  earnedAt  DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  badge     Badge    @relation(fields: [badgeId], references: [id])

  @@unique([userId, badgeId])
}

// ==================== 通知系统 ====================
model Notification {
  id         String           @id @default(uuid())
  userId     String           // 接收者
  type       NotificationType
  title      String
  content    String?
  targetId   String?          // 目标实体ID
  targetType String?          // 目标实体类型
  isRead     Boolean          @default(false)
  createdAt  DateTime         @default(now())

  user       User             @relation(fields: [userId], references: [id])

  @@index([userId, isRead])
  @@index([createdAt])
}

// ==================== 枚举定义 ====================
enum CircleCategory {
  PROFESSION  // 职业圈
  INTEREST    // 兴趣圈
  REGION      // 地区圈
  ACTIVITY    // 活动圈
}

enum CircleRole {
  OWNER
  ADMIN
  MEMBER
}

enum BadgeCategory {
  MILESTONE   // 里程碑
  CUMULATIVE  // 累计型
  CHALLENGE   // 挑战型
  SPECIAL     // 特殊型
  SOCIAL      // 社交型
  CONTRIBUTION // 贡献型
  LEADER      // 领队专属
}

enum NotificationType {
  LIKE        // 点赞
  COMMENT     // 评论
  FOLLOW      // 关注
  BADGE       // 获得勋章
  ACTIVITY    // 活动相关
  SYSTEM      // 系统通知
}
```

### 2.2 需要更新的现有模型

```prisma
// User 模型添加关系
model User {
  // ... 现有字段 ...

  // 新增关系
  posts          Post[]
  postLikes      PostLike[]
  commentLikes   CommentLike[]
  followers      Follow[]       @relation("Following")
  following      Follow[]       @relation("Followers")
  createdCircles Circle[]       @relation("CircleCreator")
  circleMembers  CircleMember[]
  activityPhotos ActivityPhoto[]
  userBadges     UserBadge[]
  notifications  Notification[]
}

// Activity 模型添加关系
model Activity {
  // ... 现有字段 ...

  // 新增关系
  posts   Post[]
  photos  ActivityPhoto[]
}

// Route 模型添加关系
model Route {
  // ... 现有字段 ...
  creatorId String?  // 线路贡献者 (新增)

  // 新增关系
  posts   Post[]
  creator User?     @relation("RouteCreator", fields: [creatorId], references: [id])
}

// Club 模型添加关系
model Club {
  // ... 现有字段 ...

  // 新增关系
  circles Circle[]
}
```

---

## 3. 后端开发计划 (Backend)

### 3.1 模块结构

```
backend/src/
├── social/
│   ├── social.module.ts
│   ├── post/
│   │   ├── post.controller.ts
│   │   ├── post.service.ts
│   │   └── dto/
│   ├── comment/
│   │   ├── comment.controller.ts
│   │   ├── comment.service.ts
│   │   └── dto/
│   ├── follow/
│   │   ├── follow.controller.ts
│   │   ├── follow.service.ts
│   │   └── dto/
│   └── feed/
│       ├── feed.controller.ts
│       └── feed.service.ts
├── circle/
│   ├── circle.module.ts
│   ├── circle.controller.ts
│   ├── circle.service.ts
│   └── dto/
├── achievement/
│   ├── achievement.module.ts
│   ├── badge.controller.ts
│   ├── badge.service.ts
│   └── achievement.listener.ts  // 事件监听器
├── album/
│   ├── album.module.ts
│   ├── album.controller.ts
│   └── album.service.ts
└── notification/
    ├── notification.module.ts
    ├── notification.controller.ts
    └── notification.service.ts
```

### 3.2 API 端点设计

#### 帖子模块 `/posts`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| POST | /posts | 创建帖子 |
| GET | /posts | 获取帖子列表 (分页/筛选) |
| GET | /posts/:id | 获取帖子详情 |
| DELETE | /posts/:id | 删除帖子 |
| POST | /posts/:id/like | 点赞帖子 |
| DELETE | /posts/:id/like | 取消点赞 |

#### 评论模块 `/comments`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| POST | /posts/:postId/comments | 创建评论 |
| GET | /posts/:postId/comments | 获取评论列表 |
| DELETE | /comments/:id | 删除评论 |
| POST | /comments/:id/like | 点赞评论 |

#### 关注模块 `/users`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| POST | /users/:id/follow | 关注用户 |
| DELETE | /users/:id/follow | 取消关注 |
| GET | /users/:id/followers | 获取粉丝列表 |
| GET | /users/:id/following | 获取关注列表 |

#### 圈子模块 `/circles`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| POST | /circles | 创建圈子 |
| GET | /circles | 获取圈子列表 |
| GET | /circles/:id | 获取圈子详情 |
| POST | /circles/:id/join | 加入圈子 |
| DELETE | /circles/:id/leave | 退出圈子 |
| GET | /circles/:id/posts | 获取圈子帖子 |

#### 活动相册 `/activities/:id/photos`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| POST | /activities/:id/photos | 上传照片 |
| GET | /activities/:id/photos | 获取相册 |
| DELETE | /activities/:id/photos/:photoId | 删除照片 |
| PUT | /activities/:id/photos/:photoId/feature | 设为精选 |

#### 成就系统 `/achievements`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| GET | /badges | 获取所有勋章定义 |
| GET | /users/:id/badges | 获取用户勋章 |
| GET | /leaderboard/routes | 线路贡献排行 |
| GET | /leaderboard/active | 活跃度排行 |

#### Feed 流 `/feed`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| GET | /feed | 获取个人 Feed (关注的人) |
| GET | /feed/recommend | 推荐 Feed |
| GET | /feed/circle/:id | 圈子 Feed |

#### 通知 `/notifications`
| Method | Endpoint | 描述 |
|:---|:---|:---|
| GET | /notifications | 获取通知列表 |
| PUT | /notifications/:id/read | 标记已读 |
| PUT | /notifications/read-all | 全部已读 |
| GET | /notifications/unread-count | 未读数量 |

---

## 4. 前端开发计划 (Frontend)

### 4.1 页面结构

```
frontend/src/pages/
├── community/
│   ├── index.tsx          # 社区首页 (Feed流)
│   └── search.tsx         # 搜索帖子/圈子
├── post/
│   ├── publish.tsx        # 发布帖子
│   └── detail.tsx         # 帖子详情
├── circle/
│   ├── index.tsx          # 圈子广场
│   ├── detail.tsx         # 圈子详情
│   └── create.tsx         # 创建圈子
├── user/
│   └── [id].tsx           # 他人主页
├── album/
│   └── [activityId].tsx   # 活动相册
├── leaderboard/
│   └── index.tsx          # 排行榜
└── profile/
    ├── index.tsx          # 个人中心 (升级)
    ├── badges.tsx         # 我的勋章
    ├── footprint.tsx      # 足迹地图
    └── followers.tsx      # 粉丝/关注
```

### 4.2 核心组件

```
frontend/src/components/
├── social/
│   ├── PostCard.tsx       # 帖子卡片
│   ├── PostList.tsx       # 帖子列表 (虚拟滚动)
│   ├── CommentList.tsx    # 评论列表
│   ├── CommentInput.tsx   # 评论输入框
│   ├── LikeButton.tsx     # 点赞按钮 (含动画)
│   └── SharePanel.tsx     # 分享面板
├── circle/
│   ├── CircleCard.tsx     # 圈子卡片
│   └── CircleHeader.tsx   # 圈子头部信息
├── user/
│   ├── UserCard.tsx       # 用户卡片 (头像+昵称+关注按钮)
│   ├── BadgeWall.tsx      # 勋章墙
│   ├── FootprintMap.tsx   # 足迹地图
│   └── StatsPanel.tsx     # 统计面板
├── album/
│   ├── PhotoGrid.tsx      # 照片网格
│   └── PhotoUploader.tsx  # 多图上传
└── notification/
    └── NotificationList.tsx
```

---

## 5. 开发排期 (3周)

### Week 7: 帖子与互动 (Phase 3.1)

| 任务ID | 任务 | 优先级 | 估时 |
|:---|:---|:---|:---|
| DB-07 | 迁移数据库 (Post, Comment, Like, Follow) | P0 | 2h |
| BE-08 | 实现 PostService (CRUD + 点赞) | P0 | 4h |
| BE-09 | 实现 CommentService (含嵌套回复) | P0 | 3h |
| BE-10 | 实现 FollowService | P0 | 2h |
| BE-11 | 实现 FeedService (Pull模式) | P1 | 3h |
| FE-11 | 开发 PostCard / PostList 组件 | P0 | 4h |
| FE-12 | 开发发布帖子页面 (含多图上传) | P0 | 4h |
| FE-13 | 开发帖子详情页 (含评论) | P0 | 4h |
| FE-14 | 开发社区首页 (Feed流) | P0 | 3h |
| TEST-05 | PostService 单元测试 | P1 | 2h |

### Week 8: 圈子与相册 (Phase 3.2)

| 任务ID | 任务 | 优先级 | 估时 |
|:---|:---|:---|:---|
| DB-08 | 迁移数据库 (Circle, CircleMember, ActivityPhoto) | P0 | 2h |
| BE-12 | 实现 CircleService | P0 | 4h |
| BE-13 | 实现 AlbumService (活动相册) | P0 | 3h |
| BE-14 | 实现用户关系查询 (粉丝/关注列表) | P1 | 2h |
| FE-15 | 开发圈子广场页面 | P0 | 4h |
| FE-16 | 开发圈子详情页面 | P0 | 4h |
| FE-17 | 开发活动相册页面 | P0 | 4h |
| FE-18 | 升级个人中心 (统计面板/关注数) | P1 | 3h |
| FE-19 | 开发他人主页 | P1 | 3h |
| TEST-06 | CircleService 单元测试 | P1 | 2h |

### Week 9: 成就与通知 (Phase 3.3)

| 任务ID | 任务 | 优先级 | 估时 |
|:---|:---|:---|:---|
| DB-09 | 迁移数据库 (Badge, UserBadge, Notification) | P0 | 2h |
| BE-15 | 初始化勋章数据 (Seed) | P0 | 2h |
| BE-16 | 实现 AchievementService (勋章发放) | P0 | 4h |
| BE-17 | 实现 AchievementListener (事件监听) | P0 | 3h |
| BE-18 | 实现 NotificationService | P1 | 3h |
| BE-19 | 实现排行榜接口 | P1 | 2h |
| FE-20 | 开发勋章墙组件 | P0 | 3h |
| FE-21 | 开发足迹地图组件 | P1 | 4h |
| FE-22 | 开发排行榜页面 | P2 | 3h |
| FE-23 | 开发通知列表页面 | P1 | 3h |
| TEST-07 | E2E测试: 发帖→点赞→评论流程 | P0 | 3h |

---

## 6. 技术架构补充

### 6.0 内容安全与资源管理 (Critical)

#### 6.0.1 敏感词过滤 (Content Moderation)

**合规要求**: 微信小程序审核要求必须接入内容安全检测，否则可能无法通过审核。

**实现策略**:

```typescript
// content-security.service.ts
@Injectable()
export class ContentSecurityService {
  // 环境开关：非微信环境下跳过检测
  private readonly enableWxCheck = process.env.ENABLE_WX_CONTENT_CHECK === 'true';

  async checkContent(content: string): Promise<ContentCheckResult> {
    // 1. 本地敏感词库检测 (始终执行)
    const localResult = await this.localSensitiveWordCheck(content);
    if (!localResult.pass) {
      return localResult;
    }

    // 2. 微信内容安全 API (仅生产环境)
    if (this.enableWxCheck) {
      return await this.wxMsgSecCheck(content);
    }

    return { pass: true };
  }

  // 微信小程序 security.msgSecCheck 接口
  private async wxMsgSecCheck(content: string): Promise<ContentCheckResult> {
    // 调用微信内容安全接口
    // https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html
  }
}
```

**环境变量配置**:
```bash
# .env.development
ENABLE_WX_CONTENT_CHECK=false  # 开发环境关闭

# .env.production
ENABLE_WX_CONTENT_CHECK=true   # 生产环境开启
```

**集成点**:
- `PostService.createPost()` - 发布帖子前检测
- `CommentService.createComment()` - 发布评论前检测
- `CircleService.createCircle()` - 创建圈子名称/简介检测

**本地敏感词库**:
- 维护 `src/common/data/sensitive-words.txt`
- 使用 DFA (确定有限自动机) 算法高效匹配
- 支持热更新 (Redis 缓存)

#### 6.0.2 OSS 资源清理策略 (Resource Cleanup)

**问题**: 删除 Post/ActivityPhoto 数据库记录时，OSS 物理文件不会自动删除，造成存储浪费。

**解决方案**: 异步事件驱动清理

```typescript
// 删除帖子时发送清理事件
@Injectable()
export class PostService {
  async deletePost(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });

    // 1. 删除数据库记录 (级联删除 PostImage)
    await this.prisma.post.delete({ where: { id: postId } });

    // 2. 发送异步清理事件
    this.eventEmitter.emit('oss.cleanup', {
      urls: post.images.map(img => img.url),
    });
  }
}

// 异步清理消费者
@Injectable()
export class OssCleanupListener {
  @OnEvent('oss.cleanup')
  async handleCleanup(payload: { urls: string[] }) {
    for (const url of payload.urls) {
      try {
        await this.ossService.deleteObject(url);
      } catch (error) {
        // 记录失败，后续定时任务重试
        await this.logFailedCleanup(url, error);
      }
    }
  }
}
```

**补充机制**:
- 定时任务: 每日扫描 `cleanup_failed` 表，重试失败的删除
- 监控告警: OSS 存储增长异常时告警

**优先级**: P2 (MVP 后实现，先记录 TECH-01 任务)

### 6.1 Feed 流策略

采用 **Pull 模式 + 热点缓存**:
1. 用户请求 Feed 时实时查询
2. 热门帖子缓存到 Redis (TTL 5分钟)
3. 分页采用 cursor-based 而非 offset

```typescript
// FeedService 伪代码
async getPersonalFeed(userId: string, cursor?: string) {
  const followingIds = await this.getFollowingIds(userId);
  return this.prisma.post.findMany({
    where: { userId: { in: followingIds } },
    orderBy: { createdAt: 'desc' },
    cursor: cursor ? { id: cursor } : undefined,
    take: 20,
  });
}
```

### 6.2 成就触发机制

```typescript
// achievement.listener.ts
@Injectable()
export class AchievementListener {
  @OnEvent('enrollment.checked_in')
  async handleCheckIn(payload: { userId: string; activityId: string }) {
    const count = await this.getCompletedActivityCount(payload.userId);
    if (count === 1) {
      await this.awardBadge(payload.userId, 'FIRST_HIKE');
    }
    if (count === 10) {
      await this.awardBadge(payload.userId, 'TRAIL_WALKER');
    }
  }
}
```

### 6.3 图片上传策略

1. 前端压缩 (max 1920px, quality 0.8)
2. 直传 OSS (获取临时凭证)
3. 上传成功后回调后端保存记录

---

## 7. 验收标准

### 功能验收
1. ✅ 用户可发布图文动态，支持最多 9 张图片
2. ✅ 用户可对帖子点赞、评论，评论支持回复
3. ✅ 用户可关注其他用户，查看粉丝/关注列表
4. ✅ 用户可加入/创建圈子，在圈子内发帖
5. ✅ 活动完成后，参与者可上传照片到活动相册
6. ✅ 完成特定条件后，用户自动获得对应勋章
7. ✅ 个人中心展示统计数据、勋章墙、足迹地图

### 性能验收
- Feed 加载时间 < 500ms
- 图片上传支持断点续传
- 列表滚动流畅 (60fps)

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|:---|:---|
| 数据库迁移复杂 | 分批迁移，每个子阶段独立迁移 |
| 图片存储成本 | 限制上传数量，前端压缩 |
| Feed 性能瓶颈 | Redis 缓存 + cursor 分页 |
| 用户活跃度低 | 与活动系统深度整合，完成活动后提示发布动态 |
