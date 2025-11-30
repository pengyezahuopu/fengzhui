# 户外运动管理平台 Phase 3 (社区与社交) 开发任务清单 V2.1

**版本**: 2.1 (Phase 3.1 已完成)
**更新日期**: 2025-11-29

---

## Phase 3.1: 帖子与互动 (Week 7) ✅ 已完成

### Database
- [x] **DB-07**: 迁移数据库 Schema
  - [x] 添加 Post, PostImage, PostLike 表
  - [x] 重构 Comment 表 (添加 postId, parentId)
  - [x] 添加 CommentLike 表
  - [x] 添加 Follow 表
  - [x] 更新 User 模型关系
  - [x] 添加 Circle, CircleMember 表 (Phase 3.2 预置)
  - [x] 添加 ActivityPhoto, Badge, UserBadge, Notification 表 (Phase 3.3 预置)

### Backend
- [x] **BE-07.5**: 实现 ContentSecurityService (内容安全)
  - [x] 创建 `ContentSecurityModule`
  - [x] 实现本地敏感词库检测 (DFA 算法)
  - [x] 集成微信 `security.msgSecCheck` API
  - [x] 添加环境开关 `ENABLE_WX_CONTENT_CHECK`
  - [x] 维护敏感词库文件 `sensitive-words.txt`

- [x] **BE-08**: 实现 PostService
  - [x] `createPost()` - 创建帖子 (含多图)
  - [x] `getPosts()` - 获取帖子列表 (分页/筛选)
  - [x] `getPostById()` - 获取帖子详情
  - [x] `deletePost()` - 删除帖子 (含 OSS 清理事件)
  - [x] `likePost()` / `unlikePost()` - 点赞/取消点赞
  - [x] **集成内容安全检测** (createPost 前调用)

- [x] **BE-09**: 实现 CommentService
  - [x] `createComment()` - 创建评论 (支持回复)
  - [x] `getComments()` - 获取评论列表 (含嵌套)
  - [x] `deleteComment()` - 删除评论
  - [x] `likeComment()` / `unlikeComment()`
  - [x] **集成内容安全检测** (createComment 前调用)

- [x] **BE-10**: 实现 FollowService
  - [x] `follow()` / `unfollow()` - 关注/取关
  - [x] `getFollowers()` - 获取粉丝列表
  - [x] `getFollowing()` - 获取关注列表
  - [x] `isFollowing()` - 检查关注状态

- [x] **BE-11**: 实现 FeedService
  - [x] `getPersonalFeed()` - 关注的人的动态
  - [x] `getRecommendFeed()` - 推荐动态

### Frontend
- [x] **FE-11**: 开发 PostCard / PostList 组件
  - [x] PostCard: 头像、昵称、内容、图片、点赞数、评论数
  - [x] CommentList: 评论列表 + 嵌套回复
  - [x] CommentInput: 评论输入框

- [x] **FE-12**: 开发发布帖子页面 `pages/post/publish.tsx`
  - [x] 文本输入区域
  - [x] 多图上传 (最多9张)
  - [x] 关联活动/线路选择器 (UI 预留)
  - [x] 话题标签输入 (UI 预留)

- [x] **FE-13**: 开发帖子详情页 `pages/post/detail.tsx`
  - [x] 帖子内容展示
  - [x] 图片查看器 (滑动切换)
  - [x] 评论列表
  - [x] 评论输入框
  - [x] 点赞按钮

- [x] **FE-14**: 开发社区首页 `pages/community/index.tsx`
  - [x] 顶部 Tab (推荐/关注)
  - [x] Feed 流列表
  - [x] 下拉刷新 + 上拉加载
  - [x] 发布按钮 (浮动)

- [x] **FE-15**: 更新 app.config.ts
  - [x] 添加社区 Tab 到 TabBar
  - [x] 注册新页面路由

### Testing
- [x] **TEST-05**: PostService 单元测试 (9 个测试用例)
- [x] **TEST-REGRESSION**: 全量测试套件 (36/36 通过)

---

## Phase 3.2: 圈子与相册 (Week 8) ✅ 已完成

### Database
- [x] **DB-08**: 数据库 Schema (Phase 3.1 已预置)
  - [x] Circle, CircleMember 表
  - [x] ActivityPhoto 表
  - [x] Post 添加 circleId 字段
  - [x] Club 添加 circles 关系

### Backend
- [x] **BE-12**: 实现 CircleService (11 个方法)
  - [x] `createCircle()` - 创建圈子 (含内容安全检测)
  - [x] `getCircles()` - 获取圈子列表 (分类筛选、关键词搜索)
  - [x] `getCircleById()` - 圈子详情 (含加入状态)
  - [x] `joinCircle()` / `leaveCircle()` - 加入/退出
  - [x] `getCirclePosts()` - 获取圈子帖子
  - [x] `getCircleMembers()` - 获取成员列表
  - [x] `updateCircle()` - 更新圈子信息
  - [x] `isMember()` - 检查成员资格
  - [x] `getUserCircles()` - 获取用户加入的圈子

- [x] **BE-13**: 实现 AlbumService (6 个方法)
  - [x] `uploadPhoto()` - 上传照片到活动相册
  - [x] `getPhotos()` - 获取活动相册 (支持精选筛选)
  - [x] `deletePhoto()` - 删除照片 (含 OSS 清理事件)
  - [x] `featurePhoto()` - 设为精选
  - [x] `getUserPhotosInActivity()` - 获取用户在活动的照片
  - [x] `getAlbumStats()` - 获取相册统计

- [x] **BE-14**: 扩展 UserService (4 个新方法)
  - [x] `getUserProfile()` - 获取完整个人资料 (含关注状态)
  - [x] `getUserStats()` - 获取统计数据 (活动数/里程/爬升/勋章)
  - [x] `getUserPosts()` - 获取用户帖子
  - [x] `getUserBadges()` - 获取用户勋章

### Frontend
- [x] **FE-15**: 开发圈子广场页面 `pages/circle/index.tsx`
  - [x] 7 个分类筛选
  - [x] 双列圈子卡片列表
  - [x] 关键词搜索
  - [x] 无限滚动加载

- [x] **FE-16**: 开发圈子详情页 `pages/circle/detail.tsx`
  - [x] 圈子封面 + 信息头部
  - [x] 帖子/成员 Tab 切换
  - [x] 圈子帖子 Feed
  - [x] 加入/退出按钮

- [x] **FE-17**: 开发活动相册页面 `pages/album/index.tsx`
  - [x] 照片网格展示 (三列)
  - [x] 全部/精选筛选
  - [x] 统计栏 (总数/精选/贡献者)
  - [x] 照片上传入口 (UI 预留)

- [x] **FE-19**: 开发他人主页 `pages/user/profile.tsx`
  - [x] 用户资料展示 (头像/昵称/领队认证)
  - [x] 关注/取消关注按钮
  - [x] 粉丝/关注/帖子统计
  - [x] 户外数据卡片 (活动数/里程/爬升/勋章)
  - [x] TA的帖子列表

- [x] **FE-20**: 更新 app.config.ts
  - [x] 添加 circle/index, circle/detail
  - [x] 添加 album/index
  - [x] 添加 user/profile

### Testing
- [x] **TEST-06**: 后端测试 (39/39 通过)
- [x] **TEST-BUILD**: 前端 H5 构建成功

---

## Phase 3.3: 成就与通知 (Week 9) ✅ 已完成

### Database
- [x] **DB-09**: 数据库 Schema (Phase 3.1 已预置)
  - [x] Badge, UserBadge 表
  - [x] Notification 表
  - [x] Route 添加 creatorId (线路贡献者)

### Backend
- [x] **BE-15**: 初始化勋章数据 (Seed)
  - [x] 创建 18 个勋章定义 (7 个分类)
  - [x] 配置勋章触发条件 (JSON)

- [x] **BE-16**: 实现 AchievementService (6 个方法)
  - [x] `getBadges()` - 获取所有勋章 (支持分类)
  - [x] `getUserBadges()` - 获取用户勋章
  - [x] `getBadgeWall()` - 获取勋章墙
  - [x] `awardBadge()` - 发放勋章
  - [x] `checkAchievements()` - 检查并发放符合条件的勋章
  - [x] `checkAchievementsByEvent()` - 事件驱动检查

- [x] **BE-17**: 实现 AchievementListener (6 种事件)
  - [x] 监听 `enrollment.checked_in` 事件
  - [x] 监听 `activity.completed` 事件
  - [x] 监听 `post.created` 事件
  - [x] 监听 `route.created` 事件
  - [x] 监听 `follow.created` 事件
  - [x] 监听 `leader.certified` 事件

- [x] **BE-18**: 实现 NotificationService (8 个方法)
  - [x] `createNotification()` - 创建通知
  - [x] `createNotifications()` - 批量创建通知
  - [x] `getNotifications()` - 获取通知列表
  - [x] `markAsRead()` - 标记已读
  - [x] `markAllAsRead()` - 全部已读
  - [x] `getUnreadCount()` - 未读数量
  - [x] `deleteNotification()` - 删除通知
  - [x] `clearReadNotifications()` - 清除已读

- [x] **BE-19**: 实现 LeaderboardService (6 个方法)
  - [x] `getRouteContributors()` - 线路贡献排行
  - [x] `getActiveUsers()` - 活跃度排行
  - [x] `getDistanceLeaders()` - 里程排行
  - [x] `getElevationLeaders()` - 爬升排行
  - [x] `getBadgeLeaders()` - 勋章排行
  - [x] `getUserRankings()` - 我的排名

### Frontend
- [x] **FE-20**: 开发勋章墙组件 `components/user/BadgeWall.tsx`
  - [x] 勋章分类展示 (7 个分类)
  - [x] 已获得/未获得状态
  - [x] 点击查看勋章详情
  - [x] 获得时间展示

- [ ] **FE-21**: 开发足迹地图组件 (P2 延期)

- [x] **FE-22**: 开发排行榜页面 `pages/leaderboard/index.tsx`
  - [x] 5 个 Tab (活跃/里程/爬升/贡献/勋章)
  - [x] 排行列表 (Top 3 特殊样式)
  - [x] 我的排名卡片

- [x] **FE-23**: 开发通知列表页面 `pages/notification/index.tsx`
  - [x] 通知类型图标/颜色
  - [x] 已读/未读状态
  - [x] 全部已读/清除已读
  - [x] 点击跳转目标

- [x] **FE-24**: 更新 app.config.ts
  - [x] 添加 leaderboard/index
  - [x] 添加 notification/index

### Testing
- [x] **TEST-07**: 后端测试 (42/42 通过)
- [x] **TEST-BUILD**: 前端 H5 构建成功

---

## 验收检查表

### 功能验收
- [ ] 用户可发布图文动态，支持最多 9 张图片
- [ ] 用户可对帖子点赞、评论，评论支持回复
- [ ] 用户可关注其他用户，查看粉丝/关注列表
- [ ] 用户可加入/创建圈子，在圈子内发帖
- [ ] 活动完成后，参与者可上传照片到活动相册
- [ ] 完成特定条件后，用户自动获得对应勋章
- [ ] 个人中心展示统计数据、勋章墙、足迹地图

### 性能验收
- [ ] Feed 加载时间 < 500ms
- [ ] 图片上传支持断点续传
- [ ] 列表滚动流畅 (60fps)

### 质量验收
- [ ] 单元测试覆盖率 > 70%
- [ ] 无 Critical/High 级别 Bug
- [ ] 代码已通过 ESLint 检查

---

## 技术债务 (Technical Debt) - P2 优先级

以下任务在 MVP 阶段可暂不实现，但需要在正式上线前完成：

- [ ] **TECH-01**: OSS 资源清理机制
  - [ ] 实现 `OssCleanupListener` 监听删除事件
  - [ ] 删除 Post/ActivityPhoto 时异步清理 OSS 文件
  - [ ] 创建 `cleanup_failed` 表记录失败的清理任务
  - [ ] 定时任务重试失败的清理

- [ ] **TECH-02**: 敏感词库热更新
  - [ ] Redis 缓存敏感词库
  - [ ] 管理后台更新敏感词时刷新缓存

- [ ] **TECH-03**: Feed 流性能优化
  - [ ] Redis 缓存热门帖子
  - [ ] 实现 cursor-based 分页

---

## 环境配置说明

### 开发环境 (.env.development)
```bash
# 内容安全检测 - 开发环境关闭
ENABLE_WX_CONTENT_CHECK=false
```

### 生产环境 (.env.production)
```bash
# 内容安全检测 - 生产环境开启
ENABLE_WX_CONTENT_CHECK=true

# 微信小程序配置 (内容安全 API 需要)
WX_APPID=your_appid
WX_SECRET=your_secret
```
