# 户外运动管理平台 Phase 3 (社区与社交) 开发计划

**目标**: 构建“圈层化户外生活方式”社区，实现用户之间的强连接，提升平台留存率与活跃度。
**周期**: Week 7-9 (3周)

---

## 1. 核心功能模块 (Core Modules)

### 1.1 动态/游记系统 (Moments/Posts)
- **用户发布**: 支持发布图文动态（类似朋友圈/小红书），关联活动、线路、话题。
- **互动机制**: 点赞、评论、分享、收藏。
- **内容分发**: 首页推荐流（基于算法或时间序）、关注流。

### 1.2 圈子/小组 (Circles)
- **基于职业**: 律师户外群、程序员徒步组、医生跑团。
- **基于兴趣**: 摄影党、装备控、亲子游。
- **圈子功能**: 专属讨论区、圈内活动、成员管理。

### 1.3 个人主页与成就体系 (Profile & Achievements)
- **数字履历**: 展示参加过的活动、走过的线路（足迹地图）。
- **勋章系统**: “步道行者”（10次徒步）、“高原征服者”（5次4000m+）。
- **社交关系**: 关注、粉丝、互相关注。

---

## 2. 技术架构规划 (Technical Architecture)

### 2.1 数据库设计 (Schema)
- **Post**: `id`, `userId`, `content`, `images` (JSON), `activityId`, `routeId`, `tags`, `createdAt`.
- **Comment**: `id`, `postId`, `userId`, `content`, `parentId` (回复评论).
- **Like**: `id`, `userId`, `targetId` (Polymorphic: Post/Comment), `targetType`.
- **Follow**: `followerId`, `followingId`.
- **Circle**: `id`, `name`, `description`, `icon`, `creatorId`, `isOfficial`.
- **CircleMember**: `circleId`, `userId`, `role`.

### 2.2 后端服务 (Backend)
- **SocialService**: 处理发布、互动、关注逻辑。
- **FeedService**: 聚合内容流，处理查询逻辑（分页、筛选）。
- **CircleService**: 圈子创建与成员管理。
- **NotificationService**: 消息通知（点赞、评论提醒）。

### 2.3 前端开发 (Frontend)
- **页面**:
  - `pages/moments/publish`: 发布动态页。
  - `pages/moments/detail`: 动态详情页。
  - `pages/profile/user`: 他人个人主页。
  - `pages/circle/index`: 圈子广场。
- **组件**:
  - `MomentCard`: 动态卡片（展示图文、点赞数）。
  - `CommentList`: 评论列表组件。
  - `UserBadge`: 勋章展示组件。

---

## 3. 开发计划 (Roadmap)

### Week 7: 基础社交设施
- [ ] **DB-07**: 设计并迁移社交相关数据库表 (Post, Comment, Like, Follow)。
- [ ] **BE-08**: 实现动态发布 API (支持多图上传)。
- [ ] **BE-09**: 实现点赞与评论 API。
- [ ] **FE-11**: 开发动态发布页面与动态流组件。

### Week 8: 圈子与互动
- [ ] **DB-08**: 设计圈子相关表 (Circle, CircleMember)。
- [ ] **BE-10**: 实现圈子 CRUD 与加入/退出逻辑。
- [ ] **BE-11**: 实现 Feed 流查询接口 (关注的人、热门推荐)。
- [ ] **FE-12**: 开发圈子广场与详情页。
- [ ] **FE-13**: 集成活动/线路关联功能（发布动态时选择）。

### Week 9: 成就体系与优化
- [ ] **DB-09**: 设计勋章表 (Badge, UserBadge)。
- [ ] **BE-12**: 实现成就判定逻辑（监听活动完成事件，自动发放勋章）。
- [ ] **FE-14**: 升级个人主页，展示足迹地图与勋章墙。
- [ ] **TEST-05**: 社交功能全链路测试（发布->互动->通知）。

---

## 4. 验收标准 (Acceptance Criteria)
1.  用户可以流畅发布图文动态，并关联已报名的活动。
2.  用户可以在动态下进行评论和点赞，数据实时更新。
3.  用户可以加入感兴趣的圈子，并在圈子内发帖。
4.  完成特定任务（如参加3次活动）后，个人主页自动点亮对应勋章。
