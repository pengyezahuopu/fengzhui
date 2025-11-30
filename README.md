# 风追（Fengzhui）户外活动管理平台

一个面向“圈层化户外生活方式”的移动优先平台，连接用户与户外活动组织者（俱乐部/领队），提供活动发布与报名、路线库与地图、订单与支付、社区社交、俱乐部财务等完整能力。

- 核心理念：和同类人，去对的地方
- 用户路径：大学生 → 专业人士 → 企业中高层/自由职业者
- 业务闭环：线路库 → 活动 → 报名 → 订单/支付 → 保险/退款 → 结算/提现 → 社区沉淀

## 项目定位与战略

- 战略文档：`户外运动管理平台战略规划方案.md`
- 进度追踪：`claude.md`（含阶段目标与技术栈、目录结构、测试指引）

推荐先阅读以上两份文档把握产品愿景与当前实现范围。

## 技术栈

- 前端：Taro 3 + React 18 + TypeScript（H5/微信小程序），NutUI-React-Taro
- 后端：NestJS 10 + TypeScript，Prisma 5（PostgreSQL + PostGIS），Redis
- GIS：Turf.js，fast-xml-parser（GPX）

## 快速开始

### 1. 后端（开发）

```bash
cd backend
npm ci
npm run start:dev            # 3000 端口
# 可选：docker-compose up -d  启动 Postgres + Redis
# 数据库初始化
npx prisma generate
npx prisma migrate dev
npx prisma db seed           # 生成测试数据（活动/报名/订单等）
```

### 2. 前端（开发）

```bash
cd frontend
npm ci
npm run dev:h5               # H5 调试（http://localhost:10086/）
# 或小程序：npm run dev:weapp / npm run build:weapp
```

## 目录结构（摘要）

```text
backend/src/
  activity/ club/ route/ enrollment/ user/ social/
  order/ payment/ refund/ insurance/ verification/ finance/
  common/ (redis, throttler, observability, content-security ...)
frontend/src/
  pages/index, activities, activity/detail, profile, route/detail,
  community, circle, album, leaderboard, notification, club/*
  components/*  services/request.ts  store/user.tsx
```

完整结构与模块说明见 `claude.md` 的 Architecture 章节。

## 功能特性（当前）

- 活动：发布、状态管理、列表与详情、报名（联系人/手机号校验）
- 路线库：GPX 解析、海拔曲线、地图轨迹展示（PostGIS 存储）
- 社区：帖子/评论/点赞/关注、圈子与相册、勋章与通知（Phase 3）
- 商业：订单、微信支付预下单、退款策略、保险记录（Phase 4）
- 财务：俱乐部账户、交易流水、结算与提现（Phase 4）
- 运维：限流、日志与可观测性、内容安全、备份（Phase 5）

## 开发与测试

### 常用命令

- 后端：`npm run start:dev` / `npm run build` / `npm run test:e2e`
- 前端：`npm run dev:h5` / `npm test`
- 数据：`npx prisma migrate dev` / `npx prisma db seed`

### 端到端测试脚本（开发）

已提供一键 E2E 流程脚本：登录 → 选取已发布活动 → 报名 → 下单 → 预支付 → 模拟支付成功 → 查询支付状态。

```bash
cd backend
npm run e2e:order            # 默认 baseUrl=http://localhost:3000
```

### 开发环境支付闭环（H5）

- `POST /payments/prepay` 发起预支付（需 `Authorization` 与 `openId`）
- `POST /payments/:orderId/mock-success` 模拟支付成功（仅开发环境）
- `GET /payments/:orderId/status` 查询支付状态
- 前端订单结果页在“支付处理中”状态展示“模拟支付成功”按钮（仅开发环境）

## API 约定

- REST 前缀：活动 `/activities`，报名 `/enrollments`，订单 `/orders`，支付 `/payments`，社交 `/posts` 等
- 开发环境 Swagger：`/api`（如已启用）

## 贡献指南

见 `CONTRIBUTING.md`：提交规范（Conventional Commits）、分支与 PR 流程、代码风格与测试要求。

## 许可协议

采用 MIT License，详见 `LICENSE`。

## 相关文档

- `claude.md`：项目进度与技术说明（中英文混合）
- `户外运动管理平台战略规划方案.md`：产品战略与增长路径、差异化、冷启动与商业化路线图（中文）
- `.github/workflows/backend-ci.yml`：后端 CI（lint + build）

---

如需补充更多使用示例或部署文档（Docker/云环境），请在 Issue 中提出，我们将优先完善。 
