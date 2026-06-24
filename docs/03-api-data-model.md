# API 与数据模型

## 数据库模型

当前 Prisma schema 位于 `packages/db/prisma/schema.prisma`。

| 领域         | 表                                                                                |
| ------------ | --------------------------------------------------------------------------------- |
| 用户与认证   | `users`、`sessions`                                                               |
| LLM Provider | `providers`、`provider_models`                                                    |
| Data Source  | `data_source_instances`、`tracked_symbols`                                        |
| Chart        | `chart_drawings`、`user_chart_configs`                                            |
| Workspace    | `workspace_layouts`                                                               |
| Workflow     | `workflows`、`workflow_versions`、`workflow_node_executions`                      |
| Agent        | `agents`、`agent_sessions`、`agent_messages`、`agent_summaries`、`agent_memories` |

关键设计：

- API Key 和 Data Source config 使用 AES 加密字段存储。
- Workflow definition 以字符串形式存储，内容为 `{ schemaVersion, nodes, edges, viewport? }` 或兼容旧 `{ nodes, edges }`。
- `workflow_node_executions` 存每个节点的输入、输出、日志、错误、耗时和 definition hash。
- Agent Memory 用 `scope` + `targetId` 表达 user/agent/session 等不同作用域。

## 后端 API

### Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Provider

```http
GET    /api/providers
POST   /api/providers
GET    /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/test
POST   /api/providers/:id/sync
GET    /api/provider-templates
POST   /api/providers/:id/models
PATCH  /api/providers/:id/models/:modelId
DELETE /api/providers/:id/models/:modelId
```

### Data Source 与图表配置

Data source routes 挂在 `/api` 下，包含 Provider 列表、实例 CRUD、标的搜索、K 线、画线和图表配置。

典型能力：

- 列出 DataSourceProvider。
- 创建/删除 DataSourceInstance。
- 测试实例连通性。
- 按实例搜索标的、读取支持周期、读取 K 线。
- 读取/保存某实例某标的画线数据。
- 读取/更新用户图表配置。

### Workspace

```http
GET    /api/workspace/layouts
POST   /api/workspace/layouts
GET    /api/workspace/layouts/:id
PUT    /api/workspace/layouts/:id
DELETE /api/workspace/layouts/:id
POST   /api/workspace/layouts/:id/activate
```

### Workflow

```http
GET    /api/workflows
POST   /api/workflows
GET    /api/workflows/:id
PUT    /api/workflows/:id
PATCH  /api/workflows/:id/meta
PATCH  /api/workflows/:id
DELETE /api/workflows/:id
POST   /api/workflows/:id/publish
GET    /api/workflows/:id/versions
POST   /api/workflows/:id/execute
GET    /api/workflows/:id/executions
POST   /api/workflows/:id/nodes/:nodeId/run
GET    /api/workflows/:id/nodes/:nodeId/last-execution
GET    /api/workflows/:id/variables
```

`PATCH /api/workflows/:id` 是局部编辑入口，使用 `WorkflowEditOp[]`。

### Agent

```http
GET   /api/agents
POST  /api/agents
PATCH /api/agents/:id
GET   /api/agents/sessions
POST  /api/agents/sessions
GET   /api/agents/sessions/:id
GET   /api/agents/memories
POST  /api/agents/memories
POST  /api/agents/chat
```

`POST /api/agents/chat` 返回 SSE：

```text
event: session
event: text_delta
event: error
event: done
```

## API Client

`packages/api-client` 导出共享 DTO、`ApiClient` 接口、`createHttpClient()` 和 market data socket client。

前端实例位于 `apps/web/src/lib/api.ts`：

```ts
export const api: ApiClient = createHttpClient({
  baseURL: '/api',
  credentials: 'include',
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})
```

当前没有独立 `api-client-http` 或 `api-client-electron` 包。

## DataSourceProvider 接口

`packages/data-sources` 定义 Provider 插件接口。核心能力：

- `configSchema` 驱动前端配置表单。
- `resolveIdentity()` 用用户配置生成实例身份。
- `getDefaultSymbols()` / `searchSymbols()` 管理标的。
- `getQuote()` / `getKlines()` 获取行情。
- `getSupportedIntervals()` / `getIntervalSupport()` 声明周期能力。
- 可选 `subscribeQuote()` / `subscribeKlines()` 提供实时数据。

当前实现：

- `yahoo-finance`
- `ccxt`

## Market Data Socket

`packages/api-client/src/market-data.ts` 提供 `createMarketDataSocketClient()`。前端可订阅 quote/kline，server 端由 `apps/server/src/ws/market-data-socket.ts` 处理。
