# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

风追 (Fengzhui) - Outdoor Activity Management Platform. A mobile-first platform connecting users with outdoor activity leaders, providing activity booking, route management, and community features.

**核心理念**: "和同类人，去对的地方" - 圈层化户外生活方式平台

**目标用户演进路径**:
- Phase 1: 大学生 + 高校老师 (高频低客单价)
- Phase 2: 医生/律师/教师等专业人士 (低频高客单价)
- Phase 3: 企业中高层/自由职业者 (私人订制)

## Tech Stack

- **Frontend**: Taro 3.6 + React 18 + TypeScript (WeChat Mini Program)
- **Backend**: NestJS 10 + TypeScript
- **Database**: PostgreSQL 14 + PostGIS 3.3 (spatial data)
- **ORM**: Prisma 5
- **UI Components**: NutUI-React-Taro
- **GIS**: Turf.js, fast-xml-parser (GPX)
- **Cache**: Redis (Session, 热点数据缓存)

## Development Commands

### Backend (`/backend`)

```bash
npm run start:dev          # Start dev server with hot reload (port 3000)
npm run build              # Compile TypeScript
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:e2e           # Run E2E tests
npm run lint               # ESLint fix
npx prisma generate        # Regenerate Prisma client after schema changes
npx prisma migrate dev     # Create and apply migrations
npx prisma db push         # Push schema without migration (dev only)
npx prisma db seed         # Seed database with test data
```

### Frontend (`/frontend`)

```bash
npm run dev:h5             # Dev server for H5/web (debugging)
npm run build:h5           # Build H5 version
npm run dev:weapp          # Dev server for WeChat Mini Program
npm run build:weapp        # Build WeChat Mini Program
npm test                   # Run Jest tests
```

### Infrastructure

```bash
docker-compose up -d       # Start PostgreSQL + Redis
docker-compose down        # Stop services
```

## Architecture

### Backend Structure

```
backend/src/
├── activity/       # Activity CRUD, publishing, status management
├── club/           # Club creation, membership management
├── enrollment/     # Activity enrollment, payment status
├── gis/            # GPX parsing, geographic calculations
├── leader/         # Leader profiles, verification
├── route/          # Trail routes with PostGIS geometry
├── user/           # Authentication, profiles
├── social/         # Posts, comments, likes, follows, circles (Phase 3)
├── order/          # Order creation, status management (Phase 4)
├── payment/        # WeChat payment integration (Phase 4)
├── refund/         # Refund policies and processing (Phase 4)
├── insurance/      # Insurance products and records (Phase 4)
├── verification/   # Order verification/check-in (Phase 4)
├── finance/        # Club accounts, transactions, settlements (Phase 4)
├── backup/         # Data backup and recovery
├── common/
│   ├── redis/           # Redis caching service
│   ├── crypto/          # Encryption utilities
│   ├── throttler/       # Rate limiting
│   ├── observability/   # Logging and monitoring
│   └── content-security/# Content moderation
├── prisma.service.ts
└── app.module.ts
```

Each module follows NestJS pattern: `*.module.ts` → `*.controller.ts` → `*.service.ts`

### Frontend Structure

```
frontend/src/
├── pages/
│   ├── index/              # Home page
│   ├── activities/         # Activity list
│   ├── activity/detail     # Activity detail + enrollment
│   ├── profile/            # User profile
│   ├── route/detail        # Route map + elevation chart
│   ├── community/          # Social feed (Phase 3)
│   ├── circle/             # Interest circles (Phase 3)
│   ├── album/              # Activity photo albums (Phase 3)
│   ├── leaderboard/        # Rankings and achievements (Phase 3)
│   ├── notification/       # Notification center (Phase 3)
│   └── club/
│       ├── dashboard/      # Club management (Phase 4)
│       ├── finance/        # Financial overview (Phase 4)
│       └── withdrawal/     # Withdrawal requests (Phase 4)
├── components/
│   ├── map/RouteMap        # Taro Map with polyline
│   ├── chart/ElevationChart # ECharts elevation profile
│   ├── gpx/GpxUploader     # GPX file upload
│   ├── social/             # PostCard, CommentList (Phase 3)
│   ├── circle/CircleCard   # Circle display component (Phase 3)
│   ├── user/BadgeWall      # Achievement badges (Phase 3)
│   ├── activity/ActivityCard
│   └── common/ErrorBoundary
├── services/request.ts     # API client (Taro.request wrapper)
└── store/user.tsx          # React Context for user state
```

### Database Models

**Core entities**: `User`, `LeaderProfile`, `Club`, `ClubMember`, `Route`, `Activity`, `Enrollment`

**Social entities (Phase 3)**: `Post`, `PostImage`, `PostLike`, `Comment`, `CommentLike`, `Follow`, `Circle`, `CircleMember`, `ActivityPhoto`, `Badge`, `UserBadge`, `Notification`

**Commerce entities (Phase 4)**: `Order`, `Payment`, `Refund`, `RefundPolicy`, `Insurance`, `InsuranceProduct`, `ClubAccount`, `Transaction`, `Withdrawal`, `Settlement`

Route model includes PostGIS geometry fields:
- `geometry` - LineString for trail path
- `startPoint`, `endPoint` - Point geometry

### API Conventions

- Backend runs on port 3000, Swagger docs at `/api`
- Frontend API base: `http://localhost:3000` (dev)
- REST conventions: `/routes`, `/activities`, `/enrollments`
- GIS queries: `/routes?withGeo=true`, `/routes/:id/elevation`, `/routes/nearby/search`
- Social APIs: `/posts`, `/comments`, `/circles`, `/follows`, `/notifications`
- Commerce APIs: `/orders`, `/payments`, `/refunds`, `/verifications`
- Finance APIs: `/clubs/:id/account`, `/clubs/:id/transactions`, `/withdrawals`

## Key Patterns

### PostGIS Integration

Route service uses raw SQL for spatial operations:
```typescript
await this.prisma.$queryRaw`
  SELECT ST_AsGeoJSON(geometry), ST_Simplify(geometry, ${tolerance})
  FROM "Route" WHERE ST_DWithin(...)
`
```

### GPX Processing

`GpxParserService` handles GPX file parsing:
- Extracts track points with lat/lon/elevation
- Calculates distance using Turf.js
- Generates WKT for PostGIS storage
- Returns GeoJSON for frontend rendering

### Frontend Map Rendering

RouteMap component converts GeoJSON to Taro Map polyline format:
```typescript
polyline={[{
  points: geojson.coordinates.map(c => ({
    latitude: c[1], longitude: c[0]
  })),
  color: '#4A90E2', width: 4
}]}
```

### Order & Payment Flow (Phase 4)

```
Enrollment(PENDING) → Order(PENDING) → Payment → Order(PAID) → Enrollment(PAID)
                         ↓ timeout                      ↓ refund
                    Order(CANCELLED)              Order(REFUNDING) → Order(REFUNDED)
                                                        ↓ complete
                                                  Order(COMPLETED) → Settlement
```

Key services: `OrderService`, `PaymentService`, `RefundService`, `SettlementService`

## Testing

### Run specific test file
```bash
# Backend
npm test -- activity.service.spec.ts

# Frontend
npm test -- RouteMap.test.tsx
```

### Test coverage
```bash
npm run test:cov
```

## Database

Connection string in `backend/.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/fengzhui?schema=public"
```

PostGIS extension must be enabled:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Development Progress

| 阶段 | 内容 | 状态 | 说明 |
|:---|:---|:---|:---|
| Phase 1 | 核心 MVP (登录/活动/报名) | ✅ 完成 | 16/16 单元测试通过 |
| Phase 2 | 线路库 & GIS 集成 | ✅ 完成 | GPX解析、PostGIS空间查询、海拔图 |
| Phase 3 | 社交与社区系统 | ✅ 完成 | 帖子、评论、点赞、关注、圈子、相册、勋章、通知 |
| Phase 4 | 商业化与后台管理 | ✅ 完成 | 订单支付、退款策略、保险集成、俱乐部财务结算 |
| Phase 5 | 生产化 & 安全加固 | ✅ 完成 | Redis缓存、内容审核、加密、限流、可观测性、备份 |

## Core Business Entities

```
平台 (Platform)
└── 俱乐部 (Club) - 活动责任主体 & 资金结算方
    ├── ClubAccount - 俱乐部账户
    └── 领队 (Leader) - 必须挂靠俱乐部发布商业活动
        └── 活动 (Activity) - 关联线路、退款策略、保险产品
            └── 报名 (Enrollment) - 用户参与
                └── 订单 (Order) - 支付载体
                    ├── Payment - 微信支付记录
                    ├── Refund - 退款处理
                    └── Insurance - 保险记录
```

**社交模块 (Phase 3)**: Post → Comment/Like, Circle → CircleMember, Follow, Badge → UserBadge, Notification

**财务流转 (Phase 4)**: Order → Payment → Transaction → Settlement → Withdrawal

## Project Documentation

See `/docs/` for:
- `技术架构规划.md` - Architecture planning
- `户外运动管理平台战略规划方案.md` - Strategic planning (root directory)
- `业务逻辑补充_俱乐部管理.md` - Club & Leader business logic
- `PHASE_*_PLAN*.md` - Development phase plans
- `PHASE_4_PLAN_V2.md` - Commerce & admin features plan
- `TEST_REPORT_*.md` - Test reports for each phase
