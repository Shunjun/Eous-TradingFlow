# Eous TradingFlow

Eous TradingFlow 是一个低代码交易分析工作台。它把数据源、图表视图、Workflow 节点编排、LLM 分析和 Agent 对话放在同一个可视化环境里，让“取数 -> 计算/推理 -> 输出信号或报告”的过程可见、可运行、可复用。

## 文档结构

| 文档                                                     | 内容                                                    |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [01 - 总览与现状](./docs/01-overview.md)                 | 产品定位、模块边界、当前实现状态                        |
| [02 - 技术架构](./docs/02-architecture.md)               | Monorepo、应用/包结构、运行方式、技术选型               |
| [03 - API 与数据模型](./docs/03-api-data-model.md)       | 数据库模型、后端路由、API Client、数据源接口            |
| [04 - Workflow 与节点系统](./docs/04-workflow-nodes.md)  | Workflow definition、编辑器、局部编辑、Runner、节点注册 |
| [05 - Agent 与 LLM](./docs/05-agent-llm.md)              | LLM 服务、LLM 节点、Agent 对话、Memory、后续工具调用    |
| [06 - UI、工作区与图表](./docs/06-ui-workspace-chart.md) | Shell、Sidebar、Dockview 工作区、K 线图表、UI 规范      |
| [07 - 路线图](./docs/07-roadmap.md)                      | 已完成、部分完成、未开始的阶段状态                      |
| [08 - Backlog](./docs/08-backlog.md)                     | 合并后的候补需求池                                      |
| [开发规范](./docs/development-guidelines.md)             | 类型、分层、前后端编码约束                              |

## 当前技术栈

```text
工程:    pnpm workspaces + Turborepo + TypeScript
前端:    Vite 6 + React 19 + React Router 7 + Zustand
工作区:  Dockview
工作流:  React Flow (@xyflow/react)
图表:    Lightweight Charts v5 + line-tools plugins + technicalindicators
UI:      Tailwind CSS v4 + shadcn-style @eous/ui + lucide-react
后端:    Hono + Node.js 22+
数据库:  SQLite + Prisma 7
AI:      @earendil-works/pi-ai
实时:    Socket.io market data socket + Agent SSE stream
```

## 当前实现摘要

- `apps/web`：认证后控制台、Sidebar、工作区、Workflow 编辑器、Agent 页面、Settings、Watchlist/News/Datasets 页面入口。
- `apps/server`：Hono API、认证、Provider/Data Source/Workspace/Workflow/Agent 服务、Workflow Runner、Market Data socket。
- `apps/docs`：组件/产品展示用 Vite 文档应用。
- `packages/api-client`：共享 DTO、HTTP client、market data socket client。
- `packages/db`：Prisma schema、SQLite client。
- `packages/data-sources`：Yahoo Finance、CCXT 数据源 Provider 接口与注册表。
- `packages/nodes`：节点定义、前端 canvas view、服务端 executor。
- `packages/chart`：可复用 K 线组件、指标、画线工具。
- `packages/ui` / `packages/tailwind`：UI 组件与主题。

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm --filter @eous/db db:generate
pnpm --filter @eous/db db:push
pnpm dev
```

只启动开发依赖的 Postgres + Redis：

```bash
docker compose -f docker-compose.dev.yml up -d
```

全量 Docker Compose 部署：

```bash
docker compose up -d --build
```

常用检查：

```bash
pnpm typecheck
pnpm build
pnpm --filter @eous/server test
pnpm --filter @eous/web test
```
