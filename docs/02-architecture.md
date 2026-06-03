# Eous 技术架构

## 1. 技术选型

| 层面          | 选型                                   | 理由                                                 |
| ------------- | -------------------------------------- | ---------------------------------------------------- |
| Monorepo 管理 | Turborepo + pnpm workspaces            | 并行构建、依赖感知、增量编译                         |
| 前端框架      | Vite 6 + React 19 + TypeScript         | 构建快、HMR 亚秒级、无 SSR 需求的 SPA 最佳选择       |
| 路由          | React Router v7                        | 支持文件路由，Vite 原生兼容                          |
| UI 组件       | shadcn/ui + Tailwind CSS v4            | 组件源码可控、Tree-shaking、暗色模式                 |
| 流程图编辑器  | React Flow（xyflow）                   | 行业标准，Sim Studio 和 TradingGoose 均基于此        |
| 分窗布局      | react-mosaic                           | 递归拆分 + Tab 页签，i3 风格平铺，布局 JSON 可序列化 |
| 图表          | Lightweight Charts（TradingView 开源） | K 线专业级渲染，轻量高效                             |
| 状态管理      | Zustand + TanStack Query               | 全局轻量 + 服务端缓存/重取                           |
| 实时通信      | Socket.io                              | WebSocket 封装，自动降级，房间管理                   |
| Markdown      | react-markdown + 流式渲染              | LLM 报告展示 + 流式逐字                              |
| 后端框架      | Hono                                   | 超轻量，路由/中间件/WebSocket 内置，性能高           |
| 运行时        | Node.js 22+                            | LTS，生态稳定                                        |
| ORM           | Prisma                                 | 类型安全，Schema 声明式，迁移工具成熟                |
| 数据库        | SQLite（Prisma）                       | 零安装，单文件嵌入式数据库，CS 与 Electron 统一      |
| Schema 校验   | Zod                                    | 前后端共享类型校验                                   |
| AI SDK        | Vercel AI SDK                          | 统一多模型接入，流式支持                             |
| 代码沙箱      | isolated-vm                            | Python 自定义节点安全隔离执行                        |
| 桌面方案      | Electron（可选）                       | apps/desktop 独立包，不替代 CS 架构                  |
| 数据源插件    | @eous/data-sources                     | Provider 自带 configSchema，前端动态渲染配置表单     |

## 2. 项目结构

```
eous-platform/
├── package.json                    # root workspace
├── pnpm-workspace.yaml
├── turbo.json
│
├── packages/
│   ├── types/                      # @eous/types — 所有共享 TS 类型
│   │   ├── src/
│   │   │   ├── workflow.ts         # Workflow, Node, Edge 类型
│   │   │   ├── node.ts             # NodeType, NodeData 联合类型
│   │   │   ├── asset.ts            # AssetRef, AssetType
│   │   │   ├── provider.ts         # Provider 接口抽象
│   │   │   ├── execution.ts        # ExecutionRecord, NodeResult
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api-client/                 # @eous/api-client — 通信接口抽象
│   │   ├── src/
│   │   │   └── index.ts            # interface ApiClient { ... }
│   │   └── package.json
│   │
│   ├── api-client-http/            # @eous/api-client-http — CS 模式实现
│   │   ├── src/
│   │   │   └── index.ts            # createHttpClient(baseURL, getToken)
│   │   └── package.json
│   │
│   ├── api-client-electron/        # @eous/api-client-electron — Electron 模式
│   │   ├── src/
│   │   │   └── index.ts            # createElectronClient()
│   │   └── package.json
│   │
│   ├── db/                         # @eous/db — Prisma schema + 客户端
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── data-sources/              # @eous/data-sources — 数据源插件接口
│       ├── src/
│       │   ├── types.ts           # DataSourceProvider、ConfigField、SymbolInfo、Quote、Kline
│       │   ├── registry.ts        # 注册表：register / get / list
│       │   ├── index.ts
│       │   └── providers/         # 具体实现（Yahoo Finance、Binance 等）
│
├── apps/
│   ├── web/                        # Vite React 前端
│   │   ├── src/
│   │   │   ├── main.tsx            # 入口：注入 apiClient
│   │   │   ├── app.tsx             # 路由 + 布局
│   │   │   ├── routes/             # React Router 路由
│   │   │   ├── components/
│   │   │   │   ├── layout/         # 全局布局
│   │   │   │   │   ├── console-layout.tsx
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   └── sidebar.tsx
│   │   │   │   ├── dashboard/      # Dashboard 工作台组件
│   │   │   │   │   ├── WelcomeContent.tsx
│   │   │   │   │   ├── PlaceholderPanel.tsx
│   │   │   │   │   ├── ToolbarControls.tsx
│   │   │   │   │   └── ZeroState.tsx
│   │   │   │   ├── workflow/       # 工作流编辑器（P5，待实现）
│   │   │   │   ├── views/          # 共享视图组件
│   │   │   │   │   ├── line-chart.tsx
│   │   │   │   │   ├── news-list.tsx
│   │   │   │   │   ├── report-viewer.tsx
│   │   │   │   │   └── data-table.tsx
│   │   │   │   ├── agent/          # Agent 对话组件（P7，待实现）
│   │   │   │   └── assets/         # 标的管理组件（P8，待实现）
│   │   │   ├── stores/             # Zustand stores
│   │   │   ├── hooks/              # 自定义 Hooks
│   │   │   └── lib/                # 工具
│   │   │       ├── node-registry.ts
│   │   │       └── variable-resolver.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── server/                     # Hono 后端
│   │   ├── src/
│   │   │   ├── index.ts            # 入口：启动服务、注册数据源、seed
│   │   │   ├── app.ts              # Hono app 创建 + 路由注册 + 全局错误处理
│   │   │   ├── routes/             # 路由层（只做 HTTP 协议转换）
│   │   │   │   ├── auth.ts         # 注册/登录/登出/me
│   │   │   │   ├── provider.ts     # LLM Provider CRUD + 模型管理
│   │   │   │   ├── data-source.ts  # 数据源实例 CRUD + 搜索/K线
│   │   │   │   ├── workspace.ts    # 工作区布局
│   │   │   │   └── health.ts       # 健康检查
│   │   │   ├── services/           # 服务层（业务逻辑编排）
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── provider.service.ts
│   │   │   │   ├── data-source.service.ts
│   │   │   │   └── workspace.service.ts
│   │   │   ├── repositories/       # 数据访问层（Prisma 操作封装）
│   │   │   │   ├── user.repo.ts
│   │   │   │   ├── session.repo.ts
│   │   │   │   ├── provider.repo.ts
│   │   │   │   ├── data-source.repo.ts
│   │   │   │   └── workspace.repo.ts
│   │   │   ├── engine/             # 工作流执行引擎（P4，待实现）
│   │   │   ├── ws/                 # WebSocket（P2，待实现）
│   │   │   └── lib/                # 工具库
│   │   │       ├── app-error.ts     # 统一错误类
│   │   │       ├── auth-middleware.ts
│   │   │       ├── auth-utils.ts
│   │   │       ├── crypto-utils.ts
│   │   │       ├── model-sync.ts
│   │   │       ├── provider-templates.ts
│   │   │       ├── seed.ts
│   │   │       └── interval-utils.ts
│   │   └── package.json
│   │
│   └── desktop/                    # Electron 壳（V2+）
│       ├── electron/
│       │   ├── main.ts             # 主进程：窗口 + Hono 启动 + 自动签 JWT
│       │   └── preload.ts          # 预加载脚本
│       ├── src/
│       │   └── renderer.tsx        # 渲染进程入口：注入 electron client
│       └── package.json
│
└── docs/                           # 产品文档
```

### 后端分层架构

服务端采用三层架构：Route → Service → Repository。

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│  Route Layer（路由层）                    │
│  - 解析 HTTP 参数（body、params、cookie）│
│  - 调用 Service                          │
│  - 返回 JSON / Set-Cookie                │
│  - 不含任何业务逻辑或数据库操作           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Service Layer（服务层）                  │
│  - 业务校验（权限、冲突、状态）           │
│  - 编排 Repository 调用                  │
│  - 加解密（调 lib/crypto-utils）         │
│  - 外部 API 调用                         │
│  - 通过 AppError 抛出业务异常            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Repository Layer（数据访问层）           │
│  - 封装 Prisma 调用                      │
│  - 不含业务逻辑                          │
│  - 每个 repo 对应一组数据表              │
└─────────────────────────────────────────┘
                  │
                  ▼
             Prisma / SQLite
```

**错误处理**：全局 `app.onError` 统一捕获。Service 层抛出 `AppError(message, statusCode)`，Route 层不写 try/catch。

**依赖方向**：Route → Service → Repository → Prisma。层间单向依赖，不反向调用。

## 3. 数据模型

```sql
-- 用户与认证
users (id, email, name, password_hash, created_at)
sessions (id, user_id, token, expires_at)

-- API Key（加密存储）
provider_keys (
  id, user_id, provider,          -- "openai" | "alphavantage" | ...
  key_encrypted,                   -- AES-256-GCM 加密
  base_url, created_at
)

-- 工作流定义
workflows (
  id, user_id, name, description,
  definition JSONB,                -- { nodes: [...], edges: [...], viewport: {...} }
  version INT,
  created_at, updated_at
)

-- 工作流执行记录
executions (
  id, workflow_id, user_id,
  status,                          -- pending | running | completed | failed | cancelled
  triggered_by,                    -- manual | cron | event
  started_at, finished_at, error_message
)

-- 节点执行结果（每次执行、每个节点一条）
node_results (
  id, execution_id, node_id,
  status,
  input_data JSONB, output_data JSONB,
  error_message,
  started_at, finished_at
)

-- 标的关注
watched_assets (
  id, user_id, symbol,
  asset_type,                      -- stock | crypto | forex | etf
  tags TEXT[], created_at
)

-- Agent 记忆
agent_memories (
  id, user_id, agent_id,
  key TEXT, value JSONB,
  created_at, updated_at
)
```

## 4. 通信层设计

```
┌─────────────────────────────────────────────────────┐
│                   packages/types                     │
│   ApiClient 接口定义（纯类型，零实现）                 │
└───────────────────────┬─────────────────────────────┘
                        │ implements
        ┌───────────────┴───────────────┐
        │                               │
┌───────┴──────────┐          ┌─────────┴──────────┐
│ api-client-http  │          │ api-client-electron │
│                  │          │                     │
│ fetch + JWT      │          │ fetch + 本地 JWT    │
│ 浏览器用         │          │ Electron 用         │
└──────────────────┘          └─────────────────────┘
```

```typescript
// packages/api-client/index.ts
export interface ApiClient {
  // Data
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: KlineParams): Promise<OHLCVBar[]>
  searchNews(params: NewsParams): Promise<NewsArticle[]>

  // Workflow
  getWorkflows(): Promise<WorkflowSummary[]>
  getWorkflow(id: string): Promise<WorkflowDefinition>
  saveWorkflow(wf: WorkflowDefinition): Promise<void>
  executeWorkflow(id: string): Promise<ExecutionRecord>
  getExecutionStatus(id: string): Promise<ExecutionRecord>

  // Assets
  getWatchedAssets(): Promise<Asset[]>
  addAsset(asset: AssetRef): Promise<void>

  // Real-time
  subscribeExecution(id: string, onEvent: (e: ExecutionEvent) => void): () => void
}

// CS 模式入口
// apps/web/src/main.tsx
import { createHttpClient } from '@eous/api-client-http'
const client = createHttpClient('/api', () => authStore.token)

// Electron 模式入口
// apps/desktop/src/renderer.tsx
import { createElectronClient } from '@eous/api-client-electron'
const client = createElectronClient() // 内部自动处理本地 JWT
```

## 5. Vite 代理配置

```typescript
// apps/web/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001', // REST API
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
```

开发和生产都不存在跨域问题。Electron 模式下 `createElectronClient` 的 baseURL 指向 `localhost:{随机端口}`，同样走代理逻辑。

## 6. Turborepo 配置

```json
// turbo.json
{
  "globalEnv": [
    "DATABASE_URL",
    "PORT",
    "INITIAL_USER_EMAIL",
    "INITIAL_USER_PASSWORD",
    "ALLOW_SELF_REGISTRATION"
  ],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

`globalEnv` 声明全局环境变量，变量值变化时 Turbo 缓存自动失效。

```bash
# 开发：前后端一起启动
pnpm dev
# → turbo run dev
# → apps/server  :3001 (Hono)
# → apps/web     :5173 (Vite, proxy → :3001)
```

## 7. 环境变量管理

所有环境变量集中在根目录 `.env` 文件管理，不在子包中重复定义。

```
根目录 .env.example   ← 唯一的变量清单（提交到 Git）
根目录 .env           ← 开发者本地配置（gitignored）
```

| 变量                      | 用途                         | 默认值               |
| ------------------------- | ---------------------------- | -------------------- |
| `DATABASE_URL`            | Prisma SQLite 数据库文件路径 | `file:./data/dev.db` |
| `PORT`                    | Hono 服务端口                | `3001`               |
| `INITIAL_USER_EMAIL`      | 首次启动自动创建的管理员邮箱 | `admin@eous.dev`     |
| `INITIAL_USER_PASSWORD`   | 管理员密码                   | `changeme`           |
| `ALLOW_SELF_REGISTRATION` | 是否允许自助注册             | `true`               |

### 加载机制

Node.js 22+ 原生支持 `--env-file` 标志，在模块初始化之前加载环境变量。`apps/server` 的 dev 脚本通过 `--env-file ../../.env` 从根目录加载，确保 `@eous/db` 等顶层模块初始化时 `process.env` 已就绪。

```bash
# apps/server/package.json
"dev": "node --env-file ../../.env --import tsx/esm src/index.ts"
```

### Prisma CLI

`prisma.config.ts` 根据自身文件位置自动计算数据库路径，无需关心 CWD。从 `packages/db/` 直接运行即可：

```bash
cd packages/db
pnpm db:push      # 同步 schema 到 SQLite
pnpm db:migrate   # 创建迁移文件
pnpm db:generate  # 重新生成 Prisma Client
```
