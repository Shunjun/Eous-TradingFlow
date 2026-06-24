# 技术架构

## 技术选型

| 层面          | 当前实现                                                          |
| ------------- | ----------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                       |
| 前端          | Vite 6 + React 19 + TypeScript                                    |
| 路由          | React Router 7，`apps/web/src/pages` 文件式约定由本地 router 生成 |
| UI            | Tailwind CSS v4 + `@eous/ui` shadcn-style 组件                    |
| Workflow 编辑 | `@xyflow/react`                                                   |
| Workspace     | Dockview                                                          |
| 图表          | Lightweight Charts v5 + line-tools plugins                        |
| 状态          | Zustand                                                           |
| 后端          | Hono + Node.js 22                                                 |
| 数据库        | SQLite + Prisma 7                                                 |
| LLM           | `@earendil-works/pi-ai`                                           |
| 实时          | Socket.io market data socket；Agent 对话使用 SSE                  |

## Monorepo 结构

```text
apps/
  web/       Vite React 控制台
  server/    Hono API server
  docs/      Vite 文档/展示应用

packages/
  api-client/    共享 DTO、HTTP client、market data socket client
  chart/         KlineChart、指标、画线工具
  data-sources/  DataSourceProvider 接口、Yahoo Finance、CCXT
  db/            Prisma schema/client
  nodes/         Workflow node def、canvas view、server executor
  stores/        共享 Zustand store
  tailwind/      Tailwind 主题与全局 CSS
  ui/            shadcn-style UI 组件
```

## 前端结构

`apps/web/src` 主要分为：

| 目录                           | 说明                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `pages/`                       | 路由页面。认证后页面在 `(auth)` 下                       |
| `components/layout/`           | Console shell、header、sidebar                           |
| `components/workspace-layout/` | Dockview 工作区、panel/tab、layout toolbar               |
| `components/views/`            | 可放入工作区的业务视图，如 K line、Workflow              |
| `components/workflow/`         | Workflow 编辑器、canvas、节点、配置面板、变量面板、store |
| `hooks/`                       | `useAgentStream`、`useWorkflows` 等                      |
| `stores/`                      | Dashboard layout、Workflow list store                    |
| `lib/`                         | API 实例、文件路由工具                                   |

认证态页面由 `apps/web/src/pages/(auth)/layout.tsx` 的 loader 调用 `api.me()` 保护；未登录时重定向到 `/login`。

## 后端结构

`apps/server/src` 采用 Route -> Service -> Repository 分层。

```text
routes/        HTTP 参数解析、返回 JSON/SSE
services/      业务逻辑、外部调用、加解密、Runner
repositories/  Prisma 数据访问封装
lib/           auth、crypto、seed、var resolver 等通用工具
ws/            market data socket
```

当前已注册路由：

```ts
app.route('/api', healthRouter)
app.route('/api/auth', authRouter)
app.route('/api/providers', providerRouter)
app.route('/api/provider-templates', templatesRouter)
app.route('/api', dataSourceRouter)
app.route('/api', dataSourceInstanceRouter)
app.route('/api/workspace', workspaceRouter)
app.route('/api/workflows', workflowRouter)
app.route('/api/agents', agentRouter)
```

分层约束：

- Route 层只做协议转换，不直接访问 Prisma。
- Service 层负责权限、业务校验、编排 repo、抛出 `AppError`。
- Repository 层只封装数据访问，不放业务流程。
- `app.onError` 统一处理错误响应。

## 数据和配置

数据库在 `packages/db`，Prisma schema 使用 SQLite。`.env.example` 是根目录唯一环境变量清单。

常用变量：

| 变量                      | 用途              | 默认                 |
| ------------------------- | ----------------- | -------------------- |
| `DATABASE_URL`            | SQLite 数据库路径 | `file:./data/dev.db` |
| `PORT`                    | server 端口       | `3001`               |
| `INITIAL_USER_EMAIL`      | seed 初始用户邮箱 | `admin@eous.dev`     |
| `INITIAL_USER_PASSWORD`   | seed 初始用户密码 | `changeme`           |
| `ALLOW_SELF_REGISTRATION` | 是否允许注册      | `true`               |

`apps/server` dev script 使用 Node 22 的 `--env-file ../../.env` 在模块初始化前加载环境变量。

## 本地命令

```bash
pnpm dev        # turbo run dev
pnpm build      # turbo run build
pnpm typecheck  # turbo run typecheck
pnpm lint       # turbo run lint
```

数据库：

```bash
pnpm --filter @eous/db db:generate
pnpm --filter @eous/db db:push
pnpm --filter @eous/db db:migrate
pnpm --filter @eous/db db:studio
```

## 当前架构决策

- 保留 CS Web 架构为主线；Electron 仍是未来可选方向，当前仓库未实现。
- 共享类型集中在 `@eous/api-client` 和具体业务包内，不单独维护 `@eous/types`。
- Workflow definition 暂不拆节点/边表，通过 `WorkflowEditService` 提供局部编辑安全边界。
- 节点通过 `@eous/nodes` 注册表同时供前端 canvas 和后端 runner 使用。
- Agent 与 Workflow 独立建模，通过 Memory、LLM service 和后续 tools 协作。
