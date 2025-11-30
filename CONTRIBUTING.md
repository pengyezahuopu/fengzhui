# 贡献指南（Contributing Guide）

感谢你对风追（Fengzhui）的关注！为了保持高质量与高效率的协作，请遵循以下约定：

## 分支与提交流程

- 主分支：`main`（保护分支）
- 工作分支：`feature/<topic>`、`fix/<topic>`、`docs/<topic>` 等
- 提交规范：采用 [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat: ...` 新功能
  - `fix: ...` 缺陷修复
  - `docs: ...` 文档更新
  - `refactor: ...` 重构（无行为变更）
  - `test: ...` 测试相关
  - `chore: ...` 构建/依赖/脚手架等

## 开发环境

- 后端
  ```bash
  cd backend
  npm ci
  npm run start:dev
  npx prisma migrate dev
  npx prisma db seed
  ```
- 前端
  ```bash
  cd frontend
  npm ci
  npm run dev:h5
  ```

## 代码风格与质量

- TypeScript 严格模式，ESLint + Prettier
- 后端模块遵循 NestJS 结构（module/controller/service）
- 数据访问通过 Prisma；GIS 场景使用 PostGIS 与原生 SQL 时需编写注释
- 列表接口的 `limit/page` 必须做数值化与边界收敛（避免 500）

## 测试要求

- 单元测试：关键服务方法应覆盖核心路径
- E2E：订单与支付链路可使用 `npm run e2e:order`
- 提交前本地跑通：`npm run lint`、`npm run build`（后端 CI 会执行）

## 提交 Pull Request

1. 从 `main` 拉取最新代码，创建工作分支
2. 完成开发与测试，更新必要文档（README/CHANGELOG）
3. 提交规范化 commit；推送远程分支
4. 发起 PR，填写自检清单（见模板），关联相关 Issue
5. 通过 CI 后等待 Review；按意见修订并合并

## Issue 规范

- Bug 报告：请使用 `Bug report` 模板，附上可复现步骤与日志
- 功能建议：请使用 `Feature request` 模板，描述业务场景与预期收益
- 安全问题：请不要公开提交，邮件联系仓库所有者；不要在代码/提交中暴露密钥

## 安全与密钥

- `.env`、密钥文件不得入库（已在 `.gitignore`）
- 生产环境禁用模拟接口（如支付成功）；开发环境调用需身份校验

感谢你的贡献！
