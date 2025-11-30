# 户外运动管理平台 (Fengzhui)

本项目是基于《户外运动管理平台战略规划方案》的技术落地实现。

## 目录结构

```
fengzhui/
├── backend/          # 后端服务 (NestJS + PostgreSQL)
├── frontend/         # 用户端小程序 (Taro + React + NutUI)
├── docs/             # 项目文档
│   ├── 技术架构规划.md
│   └── 项目开发计划.md
└── README.md         # 项目说明
```

## 快速开始

### 1. 环境准备
- Node.js >= 16
- PostgreSQL >= 14 (且安装 PostGIS 插件)
- Redis

### 2. 启动后端
```bash
cd backend
npm install
# 配置 .env 文件 (数据库连接等)
npm run start:dev
```

### 3. 启动前端 (小程序)
```bash
cd frontend
npm install
# 编译为微信小程序并在开发者工具中打开 dist 目录
npm run dev:weapp
```

## 当前进度 (Phase 1)
- [x] **文档**：完成技术架构规划与 WBS 拆解。
- [x] **后端**：初始化 NestJS 框架，配置基础模块。
- [x] **前端**：初始化 Taro React 框架，集成 NutUI 组件库。
- [x] **UI**：完成首页 Banner、热门活动列表的静态页面绘制。

## 下一步计划
请参考 `docs/项目开发计划.md` 中的 WBS 列表，优先完成数据库连接配置和用户登录接口。
